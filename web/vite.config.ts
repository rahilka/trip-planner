import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// The web app talks to the agent server through /api (proxied, so SSE works without CORS).
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
});
