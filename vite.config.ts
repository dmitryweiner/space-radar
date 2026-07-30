import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  // satellite.js re-exports an optional WASM/pthreads acceleration path we
  // never import; its worker chunk uses top-level await, which needs the ES
  // worker format (the default 'iife' format can't build it).
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
