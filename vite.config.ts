import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import ExternalReload from './vite.external-reload';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), ExternalReload()],
  server: {
    allowedHosts: true,
  }
})
