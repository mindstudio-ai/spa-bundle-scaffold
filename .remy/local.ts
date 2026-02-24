import WebSocket from 'ws';
import chokidar from 'chokidar';
import fsp from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

// Wire filenames are /‐prefixed, relative to src/ on disk
const EDITABLE_FILES = ['/App.tsx', '/OpenGraphCard.tsx'];
const toDiskPath = (filename: string) => path.join('src', filename.slice(1));
const toWireFilename = (diskRelative: string) => '/' + diskRelative.replace(/^src[\/\\]/, '');

const hash = (content: string) =>
  crypto.createHash('md5').update(content).digest('hex');

const lastHashes = new Map<string, string>();
let hasSynced = false;

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_ATTEMPTS = 5;

// ANSI formatting
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;

function log(msg: string) {
  console.log(`  ${dim(msg)}`);
}

function printBanner(previewDomain: string, direction: string) {
  const previewUrl = previewDomain
    ? (previewDomain.startsWith('http') ? previewDomain : `https://${previewDomain}`)
    : '';

  console.log();
  console.log(`  ${green('⚡')} ${bold('MindStudio Local Dev')}`);
  console.log();
  if (previewUrl) {
    console.log(`  ${green('➜')}  ${bold('Preview:')}   ${cyan(previewUrl)}`);
  }
  console.log(`  ${green('➜')}  ${bold('Editing:')}   ${EDITABLE_FILES.join(', ')}`);
  console.log(`  ${green('➜')}  ${bold('Synced:')}    ${direction}`);
  console.log();
  console.log(`  ${dim('Changes sync to the remote sandbox automatically.')}`);
  console.log(`  ${dim('Press Ctrl+C to stop.')}`);
  console.log();
}

function resolveWsUrl(input: string): string {
  const trimmed = input.trim();

  // Full URL — convert http(s) to ws(s) if needed, pass ws(s) through as-is
  if (/^(wss?|https?):\/\//i.test(trimmed)) {
    return trimmed.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  }

  // Subdomain shorthand — build full URL
  return `wss://${trimmed}.vercel.run/remy`;
}

async function getWsUrl(): Promise<string> {
  const arg = process.argv[2];
  if (arg) return resolveWsUrl(arg);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter sandbox subdomain or full URL (e.g. sb-337r61t9jnic): ', (answer) => {
      rl.close();
      resolve(resolveWsUrl(answer));
    });
  });
}

function resolveFilePath(filename: string): string {
  return path.resolve(process.cwd(), toDiskPath(filename));
}

let watcher: ReturnType<typeof chokidar.watch> | null = null;

function startWatcher(ws: WebSocket) {
  // Tear down any existing watcher before creating a new one
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  const filePaths = EDITABLE_FILES.map(resolveFilePath);

  watcher = chokidar.watch(filePaths, {
    // Wait for writes to finish before firing — handles editors and tools
    // (like Claude Code) that do multiple rapid writes to the same file.
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
    // Ignore the initial add event since we already have the file content.
    ignoreInitial: true,
  });

  watcher.on('change', async (changedPath) => {
    try {
      const code = await fsp.readFile(changedPath, 'utf8');
      const h = hash(code);

      if (h === lastHashes.get(changedPath)) return; // No actual content change
      lastHashes.set(changedPath, h);

      // Convert absolute path to wire filename
      const diskRelative = path.relative(process.cwd(), changedPath);
      const filename = toWireFilename(diskRelative);

      log(`Change detected in ${filename}, syncing to remote...`);
      ws.send(JSON.stringify({ event: 'patch', code, filename, forceHmr: true }));
      log('Synced.');
    } catch (err: any) {
      log(`Error reading file: ${err.message}`);
    }
  });

  watcher.on('error', (err: any) => {
    log(`Watcher error: ${err.message}`);
  });
}

function connect(url: string, attempt = 0) {
  const delay = Math.min(INITIAL_RECONNECT_DELAY * 2 ** attempt, MAX_RECONNECT_DELAY);

  log(attempt === 0 ? `Connecting to ${url}...` : `Reconnecting to ${url} (attempt ${attempt + 1})...`);

  const ws = new WebSocket(url);
  let connected = false;

  ws.on('open', async () => {
    connected = true;
    if (!hasSynced) {
      log('Connected. Requesting sync...');
      ws.send(JSON.stringify({ event: 'sync' }));
    } else {
      // Local files are source of truth after initial sync — push them to remote
      try {
        log('Reconnected. Pushing local files to remote...');
        for (const filename of EDITABLE_FILES) {
          const filePath = resolveFilePath(filename);
          if (fssync.existsSync(filePath)) {
            const code = await fsp.readFile(filePath, 'utf8');
            lastHashes.set(filePath, hash(code));
            ws.send(JSON.stringify({ event: 'patch', code, filename, forceHmr: true }));
          }
        }
        log('Synced local → remote.');
        startWatcher(ws);
      } catch (err: any) {
        log(`Error reading local files on reconnect: ${err.message}`);
      }
    }
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.event === 'sync') {
        const previewDomain = msg.previewDomain || '';

        // Build files map from response (support both new `files` and legacy `code`)
        const files: Record<string, string> = msg.files || {};
        if (!msg.files && typeof msg.code === 'string') {
          files['/App.tsx'] = msg.code;
        }

        let direction = '';

        for (const filename of EDITABLE_FILES) {
          const filePath = resolveFilePath(filename);
          const remoteCode = files[filename] || '';

          const hasLocalFile = fssync.existsSync(filePath);
          const localCode = hasLocalFile ? await fsp.readFile(filePath, 'utf8') : '';
          const localIsEmpty = !hasLocalFile || !localCode.trim();

          if (localIsEmpty && remoteCode) {
            // Accept remote file
            lastHashes.set(filePath, hash(remoteCode));
            await fsp.writeFile(filePath, remoteCode, 'utf8');
            if (!direction) direction = 'remote → local';
          } else if (!localIsEmpty) {
            // Push local to remote
            lastHashes.set(filePath, hash(localCode));
            ws.send(JSON.stringify({ event: 'patch', code: localCode, filename, forceHmr: true }));
            if (!direction) direction = 'local → remote';
          }
        }

        hasSynced = true;
        startWatcher(ws);
        printBanner(previewDomain, direction || 'synced');
      } else if (msg.event === 'patch' && typeof msg.code === 'string') {
        // Ignore remote patches — local files are source of truth
        const filename = msg.filename || '/App.tsx';
        log(`Ignoring remote patch for ${filename} (local is source of truth).`);
      }
    } catch {
      // Ignore non-JSON messages (e.g. the "hello?" greeting)
    }
  });

  ws.on('close', (code) => {
    if (code === 1001) {
      log('Remote sandbox shut down. Exiting.');
      process.exit(0);
    }

    const nextAttempt = connected ? 0 : attempt + 1;
    const nextDelay = connected ? INITIAL_RECONNECT_DELAY : delay;

    if (nextAttempt >= MAX_RECONNECT_ATTEMPTS) {
      log('Remote sandbox appears to be offline. Exiting.');
      process.exit(1);
    }

    log(`Reconnecting in ${nextDelay / 1000}s... (attempt ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS})`);
    setTimeout(() => connect(url, nextAttempt), nextDelay);
  });

  ws.on('error', (err) => {
    // close event will fire after this — reconnection happens there
  });
}

async function main() {
  const url = await getWsUrl();
  connect(url);
}

main();
