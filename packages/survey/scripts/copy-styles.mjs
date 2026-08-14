import { cpSync, mkdirSync, rmSync } from 'node:fs';

/**
 * Copie les feuilles de style dans `dist/themes/`.
 *
 * Étape séparée plutôt que `onSuccess` de tsup : ce dernier est appelé une fois
 * par format (ESM et CJS), et les deux invocations concurrentes se marchaient
 * dessus — laissant un dossier `themes/themes` vide derrière elles.
 */
rmSync('dist/themes', { recursive: true, force: true });
mkdirSync('dist/themes', { recursive: true });
cpSync('styles', 'dist/themes', { recursive: true });
