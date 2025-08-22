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

        // Send Vite HMR message
        if (path) {
          // Scoped reload: only refresh affected URL(s)
          server.ws.send({ type: 'full-reload', path });
        } else {
          // Global full reload
          server.ws.send({ type: 'full-reload' });
        }

        res.statusCode = 200;
        res.end('ok');
      });
    },
  };
}
