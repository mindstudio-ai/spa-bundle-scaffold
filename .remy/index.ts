import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { extractExternalPackages } from './_helpers/extractExternalPackages';
import { readPackageJsonDeps } from './_helpers/readPackageJsonDeps';
import { flushLogs, LogItem } from './_helpers/flushLogs';

type IncomingMsg =
  | { event: 'patch'; code: string }
  | Record<string, unknown>;

const PORT = 4387;
const HOST = '0.0.0.0';
const WS_PATH = '/remy';

////////////////////////////////////////////////////////////////////////////////
// Simple package sycn
////////////////////////////////////////////////////////////////////////////////
const syncPackages = async (code: string): Promise<void> => {
  const referencedPackages = extractExternalPackages(code);

  const existingPackages = await readPackageJsonDeps();
  const missingPackages = [...referencedPackages].filter((pkg) => !existingPackages.has(pkg));

  if (missingPackages.length > 0) {
    console.log(`Installing missing packages: ${missingPackages.join(', ').trim()}`);

    await new Promise<void>((resolve, reject) => {
      const child = spawn('npm', [
        'install',
        ...missingPackages,
        '--loglevel',
        'notice',
      ]);

      child.on('close', (code) => {
        resolve();
      });
      child.on('error', (err) => {
        console.log(err);
        resolve();
      });
    });
  }
}

const scheduleViteReload = async () => {
  await fetch(`http://127.0.0.1:5173/__reload?path=${encodeURIComponent('src/App.tsx')}`);
};

////////////////////////////////////////////////////////////////////////////////
// Patch code
////////////////////////////////////////////////////////////////////////////////
const handlePatch = async (code: string) => {
  // Sync any NPM packages
  await syncPackages(code);

  // Write the code updates
  const appFile = path.resolve(process.cwd(), 'src', 'App.tsx');
  await fs.mkdir(path.dirname(appFile), { recursive: true });
  await fs.writeFile(appFile, code, 'utf8');

  await scheduleViteReload();
}

////////////////////////////////////////////////////////////////////////////////
// Server
////////////////////////////////////////////////////////////////////////////////
const httpServer = createServer((req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*'); // or a specific domain instead of *
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
  console.log('[ws-server] Client connected.');

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as IncomingMsg;
      if (msg && msg.event === 'patch' && typeof msg.code === 'string') {
        console.log('[ws-server] Patching');
        await handlePatch(msg.code);
      } else {
        console.error('[ws-server] Invalid message')
      }
    } catch (err: any) {
      console.error('[ws-server] Error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[ws-server] Client disconnected.');
  });
});

httpServer.listen(PORT, () => {
  console.log(`[ws-server] Listening on ws://localhost:${PORT}${WS_PATH}`);
});

////////////////////////////////////////////////////////////////////////////////
// Dev Process
////////////////////////////////////////////////////////////////////////////////
const logBuffer: LogItem[] = [];

const spawnDevServer = () => {
  const child = spawn('npm', ['run', 'dev:vite'], {
    cwd: process.cwd(),
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk: string) => {
    logBuffer.push({ timestampMs: Date.now(), value: chunk});
  });

  child.stderr.on('data', (chunk: string) => {
    logBuffer.push({ timestampMs: Date.now(), value: chunk});
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
