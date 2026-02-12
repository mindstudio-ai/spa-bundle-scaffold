import WebSocket from 'ws';
import chokidar from 'chokidar';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const APP_FILE = path.resolve(process.cwd(), 'src', 'App.tsx');

const hash = (content: string) =>
  crypto.createHash('md5').update(content).digest('hex');

let lastHash = '';
let hasSynced = false;

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

function log(msg: string) {
  console.log(`[local-dev] ${msg}`);
}

async function getWsUrl(): Promise<string> {
  const arg = process.argv[2];
  if (arg) return arg;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter remote sandbox WS URL (e.g. ws://localhost:4387/remy): ', (answer) => {
      rl.close();
      resolve(answer.trim());
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
        log('Received App.tsx from remote.');
        lastHash = hash(msg.code);
        await fsp.writeFile(APP_FILE, msg.code, 'utf8');
        hasSynced = true;
        log('Wrote src/App.tsx. Starting file watcher...');
        startWatcher(ws);
        log('');
        log('Local dev mode active.');
        log('Edit src/App.tsx in your IDE — changes sync to the remote sandbox automatically.');
        log('Use the remote sandbox preview URL to see your changes.');
      } else if (msg.event === 'patch' && typeof msg.code === 'string') {
        // Ignore remote patches — local file is source of truth
        log('Ignoring remote patch (local file is source of truth).');
      }
    } catch {
      // Ignore non-JSON messages (e.g. the "hello?" greeting)
    }
  });

  ws.on('close', () => {
    const nextAttempt = connected ? 0 : attempt + 1;
    const nextDelay = connected ? INITIAL_RECONNECT_DELAY : delay;
    log(`Disconnected from remote. Reconnecting in ${nextDelay / 1000}s...`);
    setTimeout(() => connect(url, nextAttempt), nextDelay);
  });

  ws.on('error', (err) => {
    log(`WebSocket error: ${err.message}`);
    // close event will fire after this — reconnection happens there
  });
}

async function main() {
  const url = await getWsUrl();
  connect(url);
}

main();
