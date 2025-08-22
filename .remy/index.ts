import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { extractExternalPackages } from './_helpers/extractExternalPackages';
import { readPackageJsonDeps } from './_helpers/readPackageJsonDeps';

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
    await new Promise<void>((resolve, reject) => {
      const child = spawn('npm', [
        'install',
        ...missingPackages,
        '--loglevel',
        'info',
        '--progress',
        'true',
        '--foreground-scripts',
      ], { stdio: 'inherit' });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install exited with code ${code}`));
        }
      });

      child.on('error', (err) => reject(err));
    });
  }
}

////////////////////////////////////////////////////////////////////////////////
// Patch code
////////////////////////////////////////////////////////////////////////////////
const handlePatch = async (code: string) => {
  // Write the code updates
  const appFile = path.resolve(process.cwd(), 'src', 'App.tsx');
  await fs.mkdir(path.dirname(appFile), { recursive: true });
  await fs.writeFile(appFile, code, 'utf8');

  await syncPackages(code);
}

////////////////////////////////////////////////////////////////////////////////
// Server
////////////////////////////////////////////////////////////////////////////////
const httpServer = createServer((req, res) => {
  // Optional: small health check so hitting the URL in a browser shows something.
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(200, { 'content-type': 'text/plain' });
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
const logBuffer: string[] = [];

const writeLogs = async (logs: string[]) => {
  try {
    await fetch(
      `${process.env.REMOTE_HOSTNAME}/v1/apps/load/appId/_hooks/spa-build-servers/append-logs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${process.env.CALLBACK_TOKEN}`,
        },
        body: JSON.stringify({ logs }),
      }
    );
  } catch {
    // ignore
  }
}

const spawnDevServer = () => {
  const child = spawn('npm', ['run', 'dev:vite'], {
    cwd: process.cwd(),
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (chunk: string) => {
    const lines = chunk.split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => {
      logBuffer.push(line);
    });
  });

  child.stderr.on('data', (chunk: string) => {
    const lines = chunk.split(/\r?\n/).filter(Boolean);
    lines.forEach((line) => {
      logBuffer.push(line);
    });
  });

  child.on('close', (code) => {
    console.log(`[dev] process exited with code ${code}`);
  });

  setInterval(async () => {
    if (logBuffer.length === 0) {
      return;
    }

    const toSend = logBuffer.splice(0, logBuffer.length); // drain buffer

    try {
      await writeLogs(toSend);
    } catch (err) {
      //
    }
  }, 500);

  return child;
}
spawnDevServer();
