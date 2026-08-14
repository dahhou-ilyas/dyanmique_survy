import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = import.meta.dirname;
const packageSrc = (path: string): string => resolve(here, '../../packages/survey', path);

export default defineConfig({
  plugins: [react()],
  resolve: {
    // En développement on tape directement dans les sources du package : HMR
    // immédiat, pas de build intermédiaire. L'ordre compte — les alias les plus
    // spécifiques doivent précéder `@edb/survey`, qui est leur préfixe.
    alias: {
      '@edb/survey/core': packageSrc('src/core/index.ts'),
      '@edb/survey/runtime': packageSrc('src/runtime/index.ts'),
      '@edb/survey/builder': packageSrc('src/builder/index.ts'),
      '@edb/survey/themes': packageSrc('styles'),
      '@edb/survey': packageSrc('src/index.ts'),
    },
  },
});
