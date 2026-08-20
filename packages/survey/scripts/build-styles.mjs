import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Génère `src/element/styles.generated.ts` : la feuille du moteur de rendu, sous
 * forme de chaîne TypeScript.
 *
 * Pourquoi c'est nécessaire : le shadow DOM n'hérite pas des feuilles de la page
 * hôte. Le Web Component doit donc embarquer son CSS et l'injecter lui-même — il
 * ne peut pas se contenter d'un `import './default.css'`, qui suppose un bundler
 * côté consommateur, précisément ce dont on veut l'affranchir.
 *
 * Le script résout les `@import` récursivement puis applique une minification
 * conservatrice (commentaires et espaces superflus), sans toucher aux valeurs.
 */

const RACINE = resolve(import.meta.dirname, '..');
const ENTREE = resolve(RACINE, 'styles/default.css');
const SORTIE = resolve(RACINE, 'src/element/styles.generated.ts');

/** Résout récursivement les `@import './…'` relatifs. */
function aplatir(chemin, deja = new Set()) {
  const absolu = resolve(chemin);
  if (deja.has(absolu)) return ''; // même feuille importée deux fois
  deja.add(absolu);

  const source = readFileSync(absolu, 'utf8');
  const base = dirname(absolu);

  return source.replace(/@import\s+['"]([^'"]+)['"]\s*;/g, (_correspondance, cible) =>
    aplatir(resolve(base, cible), deja),
  );
}

/**
 * Minification volontairement prudente : on ne réécrit ni les couleurs ni les
 * unités. L'objectif est de retirer le superflu, pas d'optimiser au dernier octet
 * — le gain marginal ne justifierait pas le risque de casser une règle.
 */
function minifier(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // commentaires
    .replace(/\s*\n\s*/g, '\n') // indentation
    .replace(/\n{2,}/g, '\n') // lignes vides
    .replace(/\s*([{}:;,])\s*/g, '$1') // espaces autour des séparateurs
    .replace(/;}/g, '}') // dernier point-virgule d'un bloc
    .trim();
}

const css = minifier(aplatir(ENTREE));

// Les accolades et backticks doivent survivre au gabarit TypeScript.
const echappe = css.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(
  SORTIE,
  `// Fichier généré par scripts/build-styles.mjs — ne pas modifier à la main.\n` +
    `// Régénéré à chaque \`pnpm build\`.\n\n` +
    `export const STYLES = \`${echappe}\`;\n`,
  'utf8',
);

const brut = readFileSync(ENTREE, 'utf8').length;
console.log(
  `styles.generated.ts : ${(css.length / 1024).toFixed(1)} Ko ` +
    `(source aplatie ${(brut / 1024).toFixed(1)} Ko d'entrée)`,
);
