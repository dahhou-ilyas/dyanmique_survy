#!/usr/bin/env bash
#
# Installe le tarball dans un projet React 18 NEUF, hors du monorepo, et vérifie
# que le package s'y consomme réellement.
#
# Pourquoi ce test existe : à l'intérieur du monorepo, tout se résout depuis les
# sources. Un `exports` incomplet, un fichier absent de `files`, une dépendance
# oubliée ou une seconde copie de React ne se voient qu'ici.
#
set -euo pipefail

TARBALL="$(ls "$PWD"/tarball/*.tgz | head -1)"
echo "Tarball testé : $TARBALL"

WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

# --------------------------------------------------------------------------
# Un projet React 18 minimal, avec Vite — ce que ferait un intégrateur.
# --------------------------------------------------------------------------
cat > package.json <<'JSON'
{
  "name": "consumer-react18",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": {
    "@types/react": "^18.3.31",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^6.0.5",
    "typescript": "~6.0.3",
    "vite": "^8.2.1"
  }
}
JSON

cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
JSON

mkdir -p src

# L'application cliente : n'importe QUE le runtime.
cat > src/runtime-only.tsx <<'TSX'
import { createRoot } from 'react-dom/client';
import { SurveyRenderer } from '@dahhouilyas/survey/runtime';
import type { SurveyDefinition, SurveyResult } from '@dahhouilyas/survey/core';
import '@dahhouilyas/survey/themes/default.css';

const definition: SurveyDefinition = {
  schemaVersion: 1,
  id: 'consumer',
  title: 'Sondage',
  settings: {
    locale: 'fr',
    showProgressBar: 'top',
    showQuestionNumbers: 'off',
    showPageTitles: true,
    checkErrorsMode: 'onNextPage',
  },
  pages: [
    {
      id: 'p1',
      name: 'page1',
      elements: [{ id: 'q1', name: 'nom', type: 'text', title: 'Votre nom', isRequired: true }],
    },
  ],
};

createRoot(document.getElementById('root')!).render(
  <SurveyRenderer
    definition={definition}
    onComplete={(result: SurveyResult) => console.log(result.answers)}
  />,
);
TSX

# Le back-office : importe le builder.
cat > src/builder-app.tsx <<'TSX'
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SurveyBuilder, createSurvey } from '@dahhouilyas/survey/builder';
import '@dahhouilyas/survey/themes/builder.css';

function App() {
  const [survey, setSurvey] = useState(createSurvey());
  return <SurveyBuilder value={survey} onChange={setSurvey} />;
}

createRoot(document.getElementById('root')!).render(<App />);
TSX

cat > runtime.html <<'HTML'
<!doctype html><html><body><div id="root"></div>
<script type="module" src="/src/runtime-only.tsx"></script></body></html>
HTML

cat > builder.html <<'HTML'
<!doctype html><html><body><div id="root"></div>
<script type="module" src="/src/builder-app.tsx"></script></body></html>
HTML

cat > vite.config.ts <<'TS'
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { runtime: 'runtime.html', builder: 'builder.html' } } },
});
TS

echo "::group::Installation"
npm install --no-fund --no-audit
npm install "$TARBALL" --no-fund --no-audit
echo "::endgroup::"

# --------------------------------------------------------------------------
# 1. Les types se résolvent-ils via le champ `exports` ?
# --------------------------------------------------------------------------
echo "::group::Typecheck du consommateur"
npx tsc --noEmit
echo "::endgroup::"

# --------------------------------------------------------------------------
# 2. Le bundle se construit-il ?
# --------------------------------------------------------------------------
echo "::group::Build du consommateur"
npx vite build
echo "::endgroup::"

# --------------------------------------------------------------------------
# 3. Le point d'entrée /core fonctionne-t-il en Node, en CJS ET en ESM ?
#    `core` n'a aucune dépendance à React : il doit tourner côté serveur.
# --------------------------------------------------------------------------
cat > cjs-check.cjs <<'JS'
const core = require('@dahhouilyas/survey/core');
const survey = core.createSurvey({ id: 'cjs' });
survey.pages[0].elements = [core.createQuestion('text', 'nom')];
const engine = new core.SurveyEngine({ definition: core.parseSurvey(survey) });
engine.setValue('nom', 'Dupont');
const answers = engine.getResult().answers;
if (answers.length !== 1 || answers[0].displayValue !== 'Dupont') {
  throw new Error('Résultat CJS inattendu : ' + JSON.stringify(answers));
}
console.log('CJS ✔');
JS

cat > esm-check.mjs <<'JS'
import {
  createSurvey, createQuestion, parseSurvey, SurveyEngine, validateSurveyDefinition,
} from '@dahhouilyas/survey/core';
const survey = createSurvey({ id: 'esm' });
survey.pages[0].elements = [createQuestion('rating', 'note')];
const parsed = parseSurvey(survey);
if (!validateSurveyDefinition(parsed).valid) throw new Error('Validation ESM en échec');
const engine = new SurveyEngine({ definition: parsed });
engine.setValue('note', 4);
if (engine.getResult().answers[0].displayValue !== '4/5') {
  throw new Error('Résultat ESM inattendu');
}
console.log('ESM ✔');
JS

echo "::group::Node CJS et ESM"
node cjs-check.cjs
node esm-check.mjs
echo "::endgroup::"

# --------------------------------------------------------------------------
# 4. Une seule copie de React ?
#    Deux copies produisent des erreurs de hooks très difficiles à diagnostiquer
#    chez le consommateur. La cause est toujours la même : React déclaré en
#    dependency au lieu de peerDependency.
# --------------------------------------------------------------------------
if [ -d "node_modules/@dahhouilyas/survey/node_modules/react" ]; then
  echo "❌ Le package embarque sa propre copie de React."
  echo "   Vérifiez que react est bien en peerDependencies et externalisé au build."
  exit 1
fi
echo "Copie unique de React ✔ ($(node -p "require('react/package.json').version"))"

# --------------------------------------------------------------------------
# 5. Le Web Component fonctionne-t-il SANS framework et SANS bundler ?
#    C'est la promesse littérale de « utilisable dans n'importe quel projet » :
#    une balise <script>, une balise <edb-survey>, rien d'autre.
# --------------------------------------------------------------------------
cat > sans-framework.html <<'HTML'
<!doctype html>
<html lang="fr">
  <body>
    <edb-survey id="s"></edb-survey>
    <script type="module">
      import './node_modules/@dahhouilyas/survey/dist/element.js';
      document.getElementById('s').definition = {
        schemaVersion: 1,
        id: 'sans-framework',
        title: 'Sondage',
        settings: {
          locale: 'fr', showProgressBar: 'off', showQuestionNumbers: 'off',
          showPageTitles: true, checkErrorsMode: 'onNextPage',
        },
        pages: [{ id: 'p1', name: 'page1', elements: [
          { id: 'q1', name: 'nom', type: 'text', title: 'Votre nom' },
        ] }],
      };
    </script>
  </body>
</html>
HTML

echo "::group::Web Component sans framework"

# Le bundle doit exister et être autonome — aucun import à résoudre par la page.
BUNDLE=node_modules/@dahhouilyas/survey/dist/element.js
[ -f "$BUNDLE" ] || { echo "❌ $BUNDLE absent du paquet publié"; exit 1; }

if grep -qE "^\s*(import|export)[^;]*from ['\"][^./]" "$BUNDLE"; then
  echo "❌ element.js comporte des imports externes : il n'est pas autonome."
  grep -nE "^\s*(import|export)[^;]*from ['\"][^./]" "$BUNDLE" | head -3
  exit 1
fi

# Exécution réelle du bundle dans un DOM, sans React ni bundler.
npm install --no-fund --no-audit --no-save jsdom@^29 >/dev/null 2>&1
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><edb-survey id="s"></edb-survey></body>', {
  runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
for (const cle of ['window', 'document', 'HTMLElement', 'customElements', 'CustomEvent', 'Node'])
  globalThis[cle] = cle === 'window' ? window : window[cle];

await import('./node_modules/@dahhouilyas/survey/dist/element.js');

const el = window.document.getElementById('s');
el.definition = {
  schemaVersion: 1, id: 'sans-framework', title: 'Sondage',
  settings: { locale: 'fr', showProgressBar: 'off', showQuestionNumbers: 'off',
              showPageTitles: true, checkErrorsMode: 'onNextPage' },
  pages: [{ id: 'p1', name: 'page1', elements: [
    { id: 'q1', name: 'nom', type: 'text', title: 'Votre nom' } ] }],
};

await new Promise((r) => setTimeout(r, 50));

const rendu = el.shadowRoot?.querySelector('div')?.textContent ?? '';
if (!rendu.includes('Votre nom')) {
  throw new Error('Le composant n\'a rien rendu : ' + JSON.stringify(rendu));
}
if (!el.engine) throw new Error('Le moteur n\'est pas exposé');
console.log('Web Component sans framework ✔');
JS
echo "::endgroup::"

echo ""
echo "✅ Le package s'installe et fonctionne dans un projet React 18 vierge,"
echo "   et son Web Component fonctionne sans framework ni bundler."
