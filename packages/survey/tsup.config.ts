import { defineConfig } from 'tsup';

/**
 * Deux configurations, deux publics.
 *
 * La première produit les points d'entrée classiques : React y reste `external`,
 * fourni par l'application hôte. Jamais deux copies de React dans un bundle.
 *
 * La seconde produit `element.js`, autonome : moteur, champs, thème et Preact
 * embarqués. Les imports React de l'arbre y sont aliasés vers `preact/compat`,
 * ce qui divise par dix le poids du moteur de rendu — ~4 Ko gzip contre ~45 pour
 * React et ReactDOM — sans réécrire un seul champ.
 *
 * Aucune des deux ne pose `clean` : elles écrivent dans le même `dist/` et se
 * terminent de façon entrelacée — celle qui nettoie effacerait les artefacts de
 * l'autre. Le nettoyage est donc une étape explicite du script `build`.
 *
 * L'alias est confiné à cette seconde configuration : une application React qui
 * consomme `/runtime` n'embarquera jamais Preact. La vérification n° 5 du plan
 * le contrôle explicitement.
 */

const ALIAS_PREACT = {
  react: 'preact/compat',
  'react-dom': 'preact/compat',
  'react-dom/client': 'preact/compat/client',
  'react/jsx-runtime': 'preact/jsx-runtime',
};

export default defineConfig([
  {
    name: 'paquets',
    entry: {
      index: 'src/index.ts',
      core: 'src/core/index.ts',
      headless: 'src/headless/index.ts',
      runtime: 'src/runtime/index.ts',
      builder: 'src/builder/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    treeshake: true,
    splitting: true,
    target: 'es2022',
    // React reste fourni par l'application hôte : jamais deux copies dans le bundle final.
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
  },
  {
    name: 'element',
    entry: { element: 'src/element/index.ts' },
    format: ['esm', 'iife'],
    globalName: 'EdbSurvey',
    dts: { entry: { element: 'src/element/index.ts' } },
    sourcemap: true,
    treeshake: true,
    // Rien n'est externalisé : le fichier doit fonctionner derrière une simple
    // balise <script>, sans installation ni bundler chez le consommateur.
    noExternal: [/.*/],
    minify: true,
    target: 'es2022',
    esbuildOptions(options) {
      options.jsx = 'automatic';
      options.jsxImportSource = 'preact';
      options.alias = ALIAS_PREACT;
    },
  },
]);
