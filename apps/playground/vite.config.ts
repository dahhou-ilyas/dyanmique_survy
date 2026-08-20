import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = import.meta.dirname;
const packageSrc = (path: string): string => resolve(here, '../../packages/survey', path);

export default defineConfig({
  plugins: [react()],
  build: {
    // Deux pages : le bac à sable React et la démonstration sans framework.
    rollupOptions: {
      input: {
        index: resolve(here, 'index.html'),
        vanilla: resolve(here, 'vanilla.html'),
      },
    },
  },
  resolve: {
    // En développement on tape directement dans les sources du package : HMR
    // immédiat, pas de build intermédiaire. L'ordre compte — les alias les plus
    // spécifiques doivent précéder `@dahhouilyas/survey`, qui est leur préfixe.
    alias: {
      '@dahhouilyas/survey/core': packageSrc('src/core/index.ts'),
      '@dahhouilyas/survey/runtime': packageSrc('src/runtime/index.ts'),
      '@dahhouilyas/survey/builder': packageSrc('src/builder/index.ts'),
      '@dahhouilyas/survey/themes': packageSrc('styles'),
      '@dahhouilyas/survey': packageSrc('src/index.ts'),
    },
  },
});
