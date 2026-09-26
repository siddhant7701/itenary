import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.API_URL || 'http://localhost:4000';

// On Vercel the web app is static; the API/realtime server runs elsewhere (see render.yaml).
if (process.env.VERCEL && !process.env.VITE_API_URL) {
  throw new Error(
    '\n\nVITE_API_URL is not set.\nIn Vercel → Project → Settings → Environment Variables, add VITE_API_URL = your API server URL ' +
      '(e.g. https://itenary-api.onrender.com), then redeploy.\n',
  );
}

export default defineConfig({
  root: 'client',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
