import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: [
      'electron/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'scripts/__tests__/**/*.test.ts',
    ],
    environmentMatchGlobs: [
      ['src/**', 'jsdom'],
      ['electron/**', 'node'],
      ['scripts/**', 'node'],
    ],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'electron/**/*.ts',
        'src/**/*.{ts,tsx}',
        'scripts/**/*.mjs',
      ],
      exclude: [
        '**/__tests__/**',
        '**/test/**',
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@electron': resolve(__dirname, 'electron'),
      '@': resolve(__dirname, 'src'),
    },
  },
});
