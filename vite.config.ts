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
    // The vendor chunk below (three.js + satellite.js + astronomy-engine +
    // react/react-dom/react-grid-layout) is inherently >500kB for a
    // client-side 3D dashboard — raise the warning threshold instead of
    // chasing an unrealistic budget.
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Split vendor deps into their own chunk, separate from app code.
        // Doesn't shrink the first-visit download, but the vendor chunk's
        // hash stays stable across app-only releases, so repeat visitors
        // don't re-download three.js et al. on every deploy.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
