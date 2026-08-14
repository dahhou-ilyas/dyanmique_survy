import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // En dev on tape directement dans les sources du package : HMR immédiat, pas de build intermédiaire.
    alias: {
      '@edb/survey/core': resolve(__dirname, '../../packages/survey/src/core/index.ts'),
      '@edb/survey/runtime': resolve(__dirname, '../../packages/survey/src/runtime/index.ts'),
      '@edb/survey/builder': resolve(__dirname, '../../packages/survey/src/builder/index.ts'),
      '@edb/survey/themes': resolve(__dirname, '../../packages/survey/styles'),
      '@edb/survey': resolve(__dirname, '../../packages/survey/src/index.ts'),
    },
  },
});
