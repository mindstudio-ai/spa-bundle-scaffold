// A minimal Vite plugin exposing /__reload to trigger a full reload.
import type { Plugin } from 'vite';

export default function ExternalReload(): Plugin {
  return {
    name: 'external-reload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__reload', (req, res) => {
        // Optional: allow path scoping via ?path=/foo
        const url = new URL(req.url || '', 'http://localhost');
        const path = url.searchParams.get('path') || undefined;
        const restart = url.searchParams.has('restart');

        // Send Vite HMR message
        if (restart) {
          server.config.logger.info(`[external-reload] Restart requested`);
          // Restart the dev server; optimize = true == "vite --force"
          server.restart(true);
        } else {
          server.ws.send(path ? { type: 'full-reload', path } : { type: 'full-reload' });
        }

        res.statusCode = 200;
        res.end('ok');
      });
    },
  };
}
