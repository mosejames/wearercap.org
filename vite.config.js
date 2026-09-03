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
        recap: resolve(__dirname, 'rcap-recap/index.html'),
        exchange: resolve(__dirname, 'uniform-exchange/index.html'),
        wishiknew: resolve(__dirname, 'wish-i-knew/index.html'),
        wishiknewread: resolve(__dirname, 'wish-i-knew/read/index.html'),
        amivault: resolve(__dirname, 'ami-vault/index.html'),
        committeeinterest: resolve(__dirname, 'committee-interest/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
