import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    esbuild: {
      drop: ['console', 'debugger']
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (/\/react-router(?:-dom)?\//.test(id)) return 'vendor-router';
          if (/\/node_modules\/leaflet\//.test(id)) return 'vendor-map';
          if (/\/@sentry\//.test(id)) return 'vendor-monitoring';
          return undefined;
        }
      }
    }
  }
});
