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
    // spécifiques doivent précéder `@dahhou-ilyas/survey`, qui est leur préfixe.
    alias: {
      '@dahhou-ilyas/survey/core': packageSrc('src/core/index.ts'),
      '@dahhou-ilyas/survey/runtime': packageSrc('src/runtime/index.ts'),
      '@dahhou-ilyas/survey/builder': packageSrc('src/builder/index.ts'),
      '@dahhou-ilyas/survey/themes': packageSrc('styles'),
      '@dahhou-ilyas/survey': packageSrc('src/index.ts'),
    },
  },
});
