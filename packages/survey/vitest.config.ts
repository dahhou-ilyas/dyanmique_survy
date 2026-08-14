import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/index.ts', 'src/**/*.test.{ts,tsx}'],
      thresholds: {
        // Le coeur métier (modèle, expressions, moteur) doit rester très couvert.
        'src/core/**': { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
});
