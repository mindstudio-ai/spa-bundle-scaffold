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
const APP_FILE = path.resolve(process.cwd(), 'src', 'App.tsx');

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
  await fs.mkdir(path.dirname(APP_FILE), { recursive: true });
  await fs.writeFile(APP_FILE, code, 'utf8');

  await syncPackages(code);
}

////////////////////////////////////////////////////////////////////////////////
// Server
////////////////////////////////////////////////////////////////////////////////
const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

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
  console.log(`[ws-server] Listening on ws://localhost:${PORT}`);
});
