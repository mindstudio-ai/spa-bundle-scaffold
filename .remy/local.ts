import WebSocket from 'ws';
import chokidar from 'chokidar';
import fsp from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const APP_FILE = path.resolve(process.cwd(), 'src', 'App.tsx');
const PLACEHOLDER_MARKER = 'Empty Interface';

const hash = (content: string) =>
  crypto.createHash('md5').update(content).digest('hex');

let lastHash = '';
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
  console.log(`  ${green('➜')}  ${bold('Editing:')}   src/App.tsx`);
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

let watcher: ReturnType<typeof chokidar.watch> | null = null;

function startWatcher(ws: WebSocket) {
  // Tear down any existing watcher before creating a new one
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  watcher = chokidar.watch(APP_FILE, {
    // Wait for writes to finish before firing — handles editors and tools
    // (like Claude Code) that do multiple rapid writes to the same file.
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
    // Ignore the initial add event since we already have the file content.
    ignoreInitial: true,
  });

  watcher.on('change', async () => {
    try {
      const code = await fsp.readFile(APP_FILE, 'utf8');
      const h = hash(code);

      if (h === lastHash) return; // No actual content change
      lastHash = h;

      log('Change detected, syncing to remote...');
      ws.send(JSON.stringify({ event: 'patch', code, forceHmr: true }));
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
      // Local file is source of truth after initial sync — push it to remote
      try {
        const code = await fsp.readFile(APP_FILE, 'utf8');
        lastHash = hash(code);
        log('Reconnected. Pushing local App.tsx to remote...');
        ws.send(JSON.stringify({ event: 'patch', code, forceHmr: true }));
        log('Synced local → remote.');
        startWatcher(ws);
      } catch (err: any) {
        log(`Error reading local file on reconnect: ${err.message}`);
      }
    }
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.event === 'sync' && typeof msg.code === 'string') {
        const previewDomain = msg.previewDomain || '';

        // Check if local file already has real work (not the placeholder)
        const hasLocalFile = fssync.existsSync(APP_FILE);
        const localCode = hasLocalFile ? await fsp.readFile(APP_FILE, 'utf8') : '';
        const localIsPlaceholder = !hasLocalFile || !localCode.trim() || localCode.includes(PLACEHOLDER_MARKER);

        if (localIsPlaceholder) {
          // Local is empty or placeholder — accept the remote file
          lastHash = hash(msg.code);
          await fsp.writeFile(APP_FILE, msg.code, 'utf8');
          hasSynced = true;
          startWatcher(ws);
          printBanner(previewDomain, 'remote → local');
        } else {
          // Local has real work — push it to remote instead
          lastHash = hash(localCode);
          ws.send(JSON.stringify({ event: 'patch', code: localCode, forceHmr: true }));
          hasSynced = true;
          startWatcher(ws);
          printBanner(previewDomain, 'local → remote');
        }
      } else if (msg.event === 'patch' && typeof msg.code === 'string') {
        // Ignore remote patches — local file is source of truth
        log('Ignoring remote patch (local file is source of truth).');
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
