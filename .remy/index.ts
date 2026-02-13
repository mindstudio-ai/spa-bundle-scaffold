import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

import { spawn } from 'child_process';
import { extractExternalPackages } from './_helpers/extractExternalPackages';
import { readPackageJsonDeps } from './_helpers/readPackageJsonDeps';
import { flushLogs, LogItem } from './_helpers/flushLogs';
import { resolveRemoteVariables } from './_helpers/resolveRemoteVariables';

type IncomingMessage =
  | { event: 'patch'; code: string; forceHmr?: boolean; }
  | { event: 'updateTestData'; testData: Record<string, any>; }
  | { event: 'sync'; }
  | Record<string, unknown>;

const PORT = 4387;
const WS_PATH = '/remy';

const logBuffer: LogItem[] = [];
const onLog = (value: string, tag?: string) => {
  const resolvedValue = tag ? `[${tag}] ${value}` : value;

  // Include timestamp in case the flush gets out of sync, we can re-sort on client
  logBuffer.push({ timestampMs: Date.now(), value: resolvedValue });
};

////////////////////////////////////////////////////////////////////////////////
// Simple package sync
////////////////////////////////////////////////////////////////////////////////
const syncPackages = async (code: string): Promise<boolean> => {
  const referencedPackages = extractExternalPackages(code);

  const existingPackages = await readPackageJsonDeps();
  const missingPackages = [...referencedPackages].filter((pkg) => !existingPackages.has(pkg));

  if (missingPackages.length === 0) {
    return false;
  }

  onLog(`Installing missing packages: ${missingPackages.join(', ').trim()}`, 'remy');

  return await new Promise<boolean>((resolve, reject) => {
    const child = spawn('npm', [
      'install',
      ...missingPackages,
      '--loglevel',
      'notice',
    ], {
      cwd: process.cwd(),
    });

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
      resolve(true);
    });

    child.on('error', (err) => {
      onLog(`Package install error: ${err}`, 'remy');
      resolve(false);
    });
  });
}

// Trigger a full live-reload when the full file is rewritten
const scheduleViteReload = async (restart: boolean) => {
  if (restart) {
    onLog('Dependency change detected, scheduling full restart', 'remy');
  } else {
    onLog('Large change detected, scheduling full reload', 'remy');
  }

  try {
    await fetch(`http://127.0.0.1:5173/__reload?path=${encodeURIComponent('src/App.tsx')}${restart ? '&restart' : ''}`);
  } catch (err) {
    onLog(`Vite reload failed (server may not be ready): ${err}`, 'remy');
  }
};

////////////////////////////////////////////////////////////////////////////////
// Patch code
////////////////////////////////////////////////////////////////////////////////
let isFirstWrite = true;
const handlePatch = async (code: string, forceHmr?: boolean) => {
  const appFile = path.resolve(process.cwd(), 'src', 'App.tsx');
  const appFileOriginal = path.resolve(process.cwd(), 'src', 'App.tsx.original');

  // If there is no code (empty string), restore the placeholder
  if (!code) {
    onLog('No code, restoring placeholder', 'remy');

    if (fssync.existsSync(appFileOriginal)) {
      const original = await fs.readFile(appFileOriginal, 'utf8');
      const current = fssync.existsSync(appFile)
        ? await fs.readFile(appFile, 'utf8')
        : '';

      // Skip if current file already matches
      if (original === current) {
        onLog('App.tsx already matches original, skipping write', 'remy');
        return;
      }

      await fs.writeFile(appFile, original, 'utf8');
    }

    await scheduleViteReload(false);
    return;
  }

  // Duplicate App.tsx to App.tsx.original (only once, before overwriting)
  if (isFirstWrite) {
    onLog('Preserving placeholder', 'remy');
    await fs.copyFile(appFile, appFileOriginal);
    isFirstWrite = false;
  }

  // Sync any NPM packages
  const didInstallPackages = await syncPackages(code);

  // Check if file content already matches
  const currentCode = fssync.existsSync(appFile)
    ? await fs.readFile(appFile, 'utf8')
    : '';

  if (currentCode === code) {
    onLog('No changes to App.tsx, skipping write', 'remy');
    return;
  }

  // Write code updates
  await fs.writeFile(appFile, code, 'utf8');

  if (forceHmr || didInstallPackages) {
    await scheduleViteReload(didInstallPackages);
  }
};

const handleUpdateTestData = async (testData: Record<string, any>) => {
  const resolved = await resolveRemoteVariables(testData);

  const value = JSON.stringify(resolved, null, 2);
  const fileContent = `export const testData: { [index: string]: any } = ${value};\n`;

  const testDataFile = path.resolve(process.cwd(), 'src', 'testData.ts');

  const currentContent = fssync.existsSync(testDataFile)
    ? await fs.readFile(testDataFile, 'utf8')
    : '';

  if (currentContent === fileContent) {
    onLog('No changes to testData.ts, skipping write', 'remy');
    return;
  }

  await fs.writeFile(testDataFile, fileContent, 'utf8');

  // Schedule a reload, as test data is often used as an initial state
  await scheduleViteReload(false);
};


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

  ws.on('error', (err) => {
    onLog(`Socket error: ${err}`, 'remy');
  })

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString()) as IncomingMessage;
      if (message && message.event === 'sync') {
        const appFile = path.resolve(process.cwd(), 'src', 'App.tsx');
        const code = fssync.existsSync(appFile)
          ? await fs.readFile(appFile, 'utf8')
          : '';
        onLog('Sync requested, sending current App.tsx', 'remy');
        ws.send(JSON.stringify({ event: 'sync', code }));
      } else if (message && message.event === 'patch' && typeof message.code === 'string') {
        onLog('Patching', 'remy');
        await handlePatch(message.code, message.forceHmr === true);
        // Broadcast to all other connected clients so they stay in sync
        const payload = JSON.stringify({ event: 'patch', code: message.code });
        for (const client of wss.clients) {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        }
      } else if (message && message.event === 'updateTestData' && typeof message.testData === 'object') {
        await handleUpdateTestData(message.testData ?? {});
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
let devChild: ReturnType<typeof spawn> | null = null;

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

  child.on('error', (err) => {
    onLog(`Vite process error: ${err}`, 'remy');
  });

  child.on('exit', (code, signal) => {
    onLog(`Vite process exited (code=${code}, signal=${signal}), restarting...`, 'remy');
    setTimeout(() => {
      devChild = spawnDevServer();
    }, 1000);
  });

  return child;
}

devChild = spawnDevServer();

// Clean up on exit — close all WS clients with 1001 (Going Away) so they
// know not to reconnect, then kill the Vite child process.
const shutdown = () => {
  for (const client of wss.clients) {
    client.close(1001, 'Server shutting down');
  }
  devChild?.kill();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Flush logs to remote on an interval
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
