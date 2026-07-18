import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        carpool: resolve(__dirname, 'carpool/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
