import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const apiKey = process.env.FULFILLSMART_API_KEY || env.FULFILLSMART_API_KEY || 'test-secret-key-2026';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          headers: {
            'X-API-Key': apiKey,
          },
        },
        '/health': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/ready': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'query-vendor': ['@tanstack/react-query'],
            'chart-vendor': ['recharts'],
            'geo-vendor': ['d3-geo'],
          },
        },
      },
    },
  };
});
