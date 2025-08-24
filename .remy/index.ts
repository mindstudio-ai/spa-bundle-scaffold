import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

import { spawn } from 'child_process';
import { extractExternalPackages } from './_helpers/extractExternalPackages';
import { readPackageJsonDeps } from './_helpers/readPackageJsonDeps';
import { flushLogs, LogItem } from './_helpers/flushLogs';

type IncomingMessage =
  | { event: 'patch'; code: string; forceHmr?: boolean; }
  | Record<string, unknown>;

const PORT = 4387;
const WS_PATH = '/remy';

const logBuffer: LogItem[] = [];
const onLog = (value: string, tag?: string) => {
  const resolvedValue = tag ? `[${tag}] ${value}` : value;
  console.log(resolvedValue);

  // Include timestamp in case the flush gets out of sync, we can re-sort on client
  logBuffer.push({ timestampMs: Date.now(), value: resolvedValue });
};

////////////////////////////////////////////////////////////////////////////////
// Simple package sync
////////////////////////////////////////////////////////////////////////////////
const syncPackages = async (code: string): Promise<void> => {
  const referencedPackages = extractExternalPackages(code);

  const existingPackages = await readPackageJsonDeps();
  const missingPackages = [...referencedPackages].filter((pkg) => !existingPackages.has(pkg));

  if (missingPackages.length > 0) {
    onLog(`Installing missing packages: ${missingPackages.join(', ').trim()}`, 'remy');

    await new Promise<void>((resolve, reject) => {
      const child = spawn('npm', [
        'install',
        ...missingPackages,
        '--loglevel',
        'notice',
      ], { cwd: process.cwd(), });

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        onLog(`${chunk}`, 'remy');
      });

      child.stderr.on('data', (chunk: string) => {
        onLog(`${chunk}`, 'remy');
      });

      child.on('close', (code) => {
        onLog('Packages synced successfully.', 'remy')
        resolve();
      });

      child.on('error', (err) => {
        onLog(`Package install error: ${err}`, 'remy');
        resolve();
      });
    });
  }
}

// Trigger a full live-reload when the full file is rewritten
const scheduleViteReload = async () => {
  onLog('Large change detected, scheduling full reload', 'remy')
  await fetch(`http://127.0.0.1:5173/__reload?path=${encodeURIComponent('src/App.tsx')}`);
};

////////////////////////////////////////////////////////////////////////////////
// Patch code
////////////////////////////////////////////////////////////////////////////////
let isFirstWrite = true;
const handlePatch = async (code: string, forceHmr?: boolean) => {
  const appFile = path.resolve(process.cwd(), 'src', 'App.tsx');
  const appFileOriginal = path.resolve(process.cwd(), 'src', 'App.tsx.original');

  // If there is no code (empty string), use the code from App.tsx.original
  if (!code) {
    onLog('No code, restoring placeholder', 'remy');

    if (fssync.existsSync(appFileOriginal)) {
      const original = await fs.readFile(appFileOriginal, 'utf8');
      await fs.writeFile(appFile, original, 'utf8');
    }

    await scheduleViteReload();
    return;
  }

  // Sync any NPM packages
  await syncPackages(code);

  // Duplicate App.tsx to App.tsx.original (only once, before overwriting)
  if (isFirstWrite) {
    onLog('Preserving placeholder', 'remy');
    await fs.copyFile(appFile, appFileOriginal);
    isFirstWrite = false;
  }

  // Write the code updates
  await fs.writeFile(appFile, code, 'utf8');

  if (forceHmr) {
    await scheduleViteReload();
  }
}

////////////////////////////////////////////////////////////////////////////////
// Server
////////////////////////////////////////////////////////////////////////////////
const httpServer = createServer((req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running. Connect via ' + WS_PATH);
  }
});

const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

wss.on('connection', (ws) => {
  onLog('Client connected.', 'remy');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as IncomingMessage;
      if (message && message.event === 'patch' && typeof message.code === 'string') {
        onLog('Patching', 'remy');
        await handlePatch(message.code, message.forceHmr === true);
      } else {
        onLog('Invalid message', 'remy')
      }
    } catch (err: any) {
      onLog(`Error: ${err}`, 'remy');
    }
  });

  ws.on('close', () => {
    onLog('Client disconnected.', 'remy');
  });
});

httpServer.listen(PORT, () => {
  onLog(`Listening on ws://localhost:${PORT}${WS_PATH}`, 'remy');
});

////////////////////////////////////////////////////////////////////////////////
// NPM Dev Process
////////////////////////////////////////////////////////////////////////////////
const spawnDevServer = () => {
  const child = spawn('npm', ['run', 'dev:vite'], {
    cwd: process.cwd(),
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk: string) => {
    onLog(chunk);
  });

  child.stderr.on('data', (chunk: string) => {
    onLog(chunk);
  });

  setInterval(async () => {
    if (logBuffer.length === 0) {
      return;
    }

    const toSend = logBuffer.splice(0, logBuffer.length); // drain buffer

    try {
      await flushLogs(toSend);
    } catch (err) {
      //
    }
  }, 500);

  return child;
}

spawnDevServer();
