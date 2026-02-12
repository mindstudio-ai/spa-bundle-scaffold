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

async function main() {
  const url = await getWsUrl();
  log(`Connecting to ${url}...`);

  const ws = new WebSocket(url);

  ws.on('open', () => {
    log('Connected. Requesting sync...');
    ws.send(JSON.stringify({ event: 'sync' }));
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.event === 'sync' && typeof msg.code === 'string') {
        log('Received App.tsx from remote.');
        lastHash = hash(msg.code);
        await fsp.writeFile(APP_FILE, msg.code, 'utf8');
        log('Wrote src/App.tsx. Starting file watcher...');
        startWatcher(ws);
        log('');
        log('Local dev mode active.');
        log('Edit src/App.tsx in your IDE — changes sync to the remote sandbox automatically.');
        log('Use the remote sandbox preview URL to see your changes.');
      } else if (msg.event === 'patch' && typeof msg.code === 'string') {
        // Remote IDE pushed an update — write it locally
        const h = hash(msg.code);
        if (h !== lastHash) {
          lastHash = h;
          await fsp.writeFile(APP_FILE, msg.code, 'utf8');
          log('Received update from remote, wrote src/App.tsx.');
        }
      }
    } catch {
      // Ignore non-JSON messages (e.g. the "hello?" greeting)
    }
  });

  ws.on('close', () => {
    log('Disconnected from remote.');
    process.exit(0);
  });

  ws.on('error', (err) => {
    log(`WebSocket error: ${err.message}`);
    process.exit(1);
  });
}

function startWatcher(ws: WebSocket) {
  const watcher = chokidar.watch(APP_FILE, {
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

  watcher.on('error', (err) => {
    log(`Watcher error: ${err.message}`);
  });
}

main();
