import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const frontendSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../frontend/src');

export default defineConfig({
  resolve: {
    alias: {
      '@': frontendSrc,
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setupTestDb.js'],
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      '../frontend/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
  },
});
