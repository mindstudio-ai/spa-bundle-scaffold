import chokidar from 'chokidar';
import fsp from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import WebSocket from 'ws';

const API_BASE =
  process.env.MINDSTUDIO_API_URL || 'https://v1.mindstudio-api.com';
const WS_BASE =
  process.env.MINDSTUDIO_WS_URL || 'wss://api-socket.mindstudio.ai';

// ANSI formatting
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;

function log(msg: string) {
  console.log(`  ${dim(msg)}`);
}

////////////////////////////////////////////////////////////////////////////////
// CLI args
////////////////////////////////////////////////////////////////////////////////

function parseArgs(): {
  key: string;
  app: string;
  workflow: string;
  step: string;
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const raw = arg.slice(2);
      const eqIdx = raw.indexOf('=');
      if (eqIdx !== -1) {
        parsed[raw.slice(0, eqIdx)] = raw.slice(eqIdx + 1);
      } else {
        const value = args[i + 1];
        if (value && !value.startsWith('--')) {
          parsed[raw] = value;
          i++;
        }
      }
    }
  }

  const key = parsed.key || process.env.MINDSTUDIO_API_KEY || '';
  const app = parsed.app || '';
  const workflow = parsed.workflow || '';
  const step = parsed.step || '';

  if (!key) {
    console.error(
      `\n  ${red('Error:')} API key required. Use --key <key> or set MINDSTUDIO_API_KEY env var.\n`,
    );
    process.exit(1);
  }
  if (!app || !workflow || !step) {
    console.error(
      `\n  ${red('Error:')} Missing required args.\n\n  Usage:\n    npm run dev:local -- --key <api-key> --app <appId> --workflow <workflowId> --step <stepId>\n`,
    );
    process.exit(1);
  }

  return { key, app, workflow, step };
}

////////////////////////////////////////////////////////////////////////////////
// API
////////////////////////////////////////////////////////////////////////////////

function getInterfaceUrl(
  app: string,
  workflow: string,
  step: string,
): string {
  return `${API_BASE}/v1/local-editor/apps/${app}/workflows/${workflow}/steps/${step}/interface`;
}

function getWsUrl(): string {
  return WS_BASE + '/local-editor';
}

async function fetchRemoteFiles(
  url: string,
  key: string,
): Promise<{ files: Record<string, string> }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

////////////////////////////////////////////////////////////////////////////////
// WebSocket
////////////////////////////////////////////////////////////////////////////////

function connectWebSocket(
  key: string,
  app: string,
  workflow: string,
  step: string,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(getWsUrl(), ['auth', key]);
    let connected = false;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'General/ConnectionEstablished' && !connected) {
          connected = true;
          ws.send(
            JSON.stringify({
              type: 'LocalEditor/Register',
              appId: app,
              workflowId: workflow,
              stepId: step,
            }),
          );
          resolve(ws);
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on('error', (err) => {
      if (!connected) reject(err);
    });

    ws.on('close', () => {
      if (!connected)
        reject(new Error('WebSocket closed before connection was established'));
    });
  });
}

function pushCode(ws: WebSocket, file: string, code: string): void {
  ws.send(
    JSON.stringify({
      type: 'LocalEditor/InterfaceCodeUpdated',
      file,
      code,
    }),
  );
}

////////////////////////////////////////////////////////////////////////////////
// File watcher
////////////////////////////////////////////////////////////////////////////////

const hash = (content: string) =>
  crypto.createHash('md5').update(content).digest('hex');

const lastHashes = new Map<string, string>();

// Map of absolute disk path → remote file key
const diskToRemoteKey = new Map<string, string>();

function toDiskPath(file: string): string {
  // Strip leading slash — API may return keys like "/App.tsx"
  const clean = file.replace(/^\//, '');
  return path.resolve(process.cwd(), 'src', clean);
}

function startWatcher(ws: WebSocket, files: string[]) {
  const filePaths = files.map(toDiskPath);

  const watcher = chokidar.watch(filePaths, {
    // Wait for writes to finish before firing — handles editors and tools
    // (like Claude Code) that do multiple rapid writes to the same file.
    awaitWriteFinish: {
      stabilityThreshold: 200,
      pollInterval: 50,
    },
    ignoreInitial: true,
  });

  watcher.on('change', async (changedPath) => {
    try {
      const code = await fsp.readFile(changedPath, 'utf8');
      const h = hash(code);

      if (h === lastHashes.get(changedPath)) return;
      lastHashes.set(changedPath, h);

      const file = diskToRemoteKey.get(changedPath);
      if (!file) return;

      log(`Change detected in ${file}, pushing to remote...`);
      pushCode(ws, file, code);
      log('Synced.');
    } catch (err: any) {
      log(`Error syncing: ${err.message}`);
    }
  });

  watcher.on('error', (err: any) => {
    log(`Watcher error: ${err.message}`);
  });
}

////////////////////////////////////////////////////////////////////////////////
// Banner
////////////////////////////////////////////////////////////////////////////////

function printBanner(files: string[], direction: string) {
  console.log();
  console.log(`  ${green('⚡')} ${bold('MindStudio Local Dev')}`);
  console.log();
  console.log(
    `  ${green('➜')}  ${bold('Editing:')}   ${files.join(', ')}`,
  );
  console.log(
    `  ${green('➜')}  ${bold('Synced:')}    ${direction}`,
  );
  console.log();
  console.log(`  ${dim('Changes push to MindStudio automatically.')}`);
  console.log(`  ${dim('Press Ctrl+C to stop.')}`);
  console.log();
}

////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////

async function main() {
  const { key, app, workflow, step } = parseArgs();
  const interfaceUrl = getInterfaceUrl(app, workflow, step);

  log('Fetching remote files...');
  const { files: remoteFiles } = await fetchRemoteFiles(interfaceUrl, key);
  const fileKeys = Object.keys(remoteFiles);

  // Build disk path → remote key mapping
  for (const file of fileKeys) {
    diskToRemoteKey.set(toDiskPath(file), file);
  }

  log('Connecting to MindStudio...');
  const ws = await connectWebSocket(key, app, workflow, step);

  let direction = '';

  for (const file of fileKeys) {
    const diskPath = toDiskPath(file);
    const remoteCode = remoteFiles[file] || '';

    const hasLocalFile = fssync.existsSync(diskPath);
    const localCode = hasLocalFile
      ? await fsp.readFile(diskPath, 'utf8')
      : '';
    const localIsEmpty = !hasLocalFile || !localCode.trim();

    if (localIsEmpty && remoteCode) {
      // No local code yet — accept remote
      await fsp.mkdir(path.dirname(diskPath), { recursive: true });
      await fsp.writeFile(diskPath, remoteCode, 'utf8');
      lastHashes.set(diskPath, hash(remoteCode));
      if (!direction) direction = 'remote → local';
    } else if (!localIsEmpty) {
      // Local code exists — push to remote
      lastHashes.set(diskPath, hash(localCode));
      pushCode(ws, file, localCode);
      if (!direction) direction = 'local → remote';
    }
  }

  ws.on('close', () => {
    log('Connection closed.');
    process.exit(0);
  });

  startWatcher(ws, fileKeys);
  printBanner(fileKeys, direction || 'synced');
}

main().catch((err) => {
  console.error(`\n  ${red('Error:')} ${err.message}\n`);
  process.exit(1);
});
