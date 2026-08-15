#!/usr/bin/env bash
#
# Mesure ce que le point d'entrée /runtime ajoute réellement au bundle d'une
# application cliente, et échoue au-delà du budget.
#
# La méthode : construire deux applications minimales — une avec React seul,
# une avec React + /runtime — et comparer. Mesurer /runtime isolément n'aurait
# pas de sens, puisque React est fourni par l'hôte.
#
# Second contrôle, tout aussi important : vérifier qu'AUCUN code du builder
# n'atterrit dans le bundle runtime. C'est la promesse des points d'entrée
# séparés, et rien d'autre ne la vérifie.
#
set -euo pipefail

# Budget en kilo-octets gzip, hors React. Mesuré à 28 Ko lors de la mise en
# place ; la marge laisse place aux évolutions sans masquer une dérive.
BUDGET_KO=${BUDGET_KO:-40}

TARBALL="$(ls "$PWD"/tarball/*.tgz | head -1)"
WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

cat > package.json <<'JSON'
{
  "name": "bundle-size-check",
  "private": true,
  "type": "module",
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": { "@vitejs/plugin-react": "^6.0.5", "vite": "^8.2.1" }
}
JSON

mkdir -p src

# Référence : React seul.
cat > src/react-only.jsx <<'JSX'
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<div>hello</div>);
JSX

# Mesure : React + le moteur de rendu.
cat > src/runtime.jsx <<'JSX'
import { createRoot } from 'react-dom/client';
import { SurveyRenderer } from '@dahhouilyas/survey/runtime';

const definition = {
  schemaVersion: 1,
  id: 'mesure',
  title: 'Sondage',
  settings: {
    locale: 'fr',
    showProgressBar: 'top',
    showQuestionNumbers: 'off',
    showPageTitles: true,
    checkErrorsMode: 'onNextPage',
  },
  pages: [
    { id: 'p1', name: 'page1', elements: [{ id: 'q1', name: 'nom', type: 'text', title: 'Nom' }] },
  ],
};

createRoot(document.getElementById('root')).render(<SurveyRenderer definition={definition} />);
JSX

cat > reactonly.html <<'HTML'
<!doctype html><html><body><div id="root"></div><script type="module" src="/src/react-only.jsx"></script></body></html>
HTML

cat > runtime.html <<'HTML'
<!doctype html><html><body><div id="root"></div><script type="module" src="/src/runtime.jsx"></script></body></html>
HTML

cat > vite.react.config.js <<'JS'
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist-react', rollupOptions: { input: { reactonly: 'reactonly.html' } } },
});
JS

cat > vite.runtime.config.js <<'JS'
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist-runtime', rollupOptions: { input: { runtime: 'runtime.html' } } },
});
JS

echo "::group::Installation"
npm install --no-fund --no-audit
npm install "$TARBALL" --no-fund --no-audit
echo "::endgroup::"

echo "::group::Construction des deux bundles"
npx vite build --config vite.react.config.js
npx vite build --config vite.runtime.config.js
echo "::endgroup::"

REACT_O=$(cat dist-react/assets/*.js | gzip -c | wc -c | tr -d ' ')
RUNTIME_O=$(cat dist-runtime/assets/*.js | gzip -c | wc -c | tr -d ' ')
DELTA_O=$((RUNTIME_O - REACT_O))
DELTA_KO=$((DELTA_O / 1024))

echo ""
echo "┌──────────────────────────────────────────────┐"
printf "│ React seul                    %6s Ko gzip │\n" "$((REACT_O / 1024))"
printf "│ React + /runtime              %6s Ko gzip │\n" "$((RUNTIME_O / 1024))"
printf "│ Apport de @dahhouilyas/survey %5s Ko gzip │\n" "$DELTA_KO"
printf "│ Budget                        %6s Ko gzip │\n" "$BUDGET_KO"
echo "└──────────────────────────────────────────────┘"
echo ""

# Résumé lisible dans l'onglet Actions.
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Taille du point d'entrée \`/runtime\`"
    echo ""
    echo "| Mesure | Taille |"
    echo "|---|---|"
    echo "| React seul | $((REACT_O / 1024)) Ko gzip |"
    echo "| React + \`/runtime\` | $((RUNTIME_O / 1024)) Ko gzip |"
    echo "| **Apport du package** | **$DELTA_KO Ko gzip** |"
    echo "| Budget | $BUDGET_KO Ko gzip |"
  } >> "$GITHUB_STEP_SUMMARY"
fi

# --------------------------------------------------------------------------
# Contrôle 1 : le budget.
# --------------------------------------------------------------------------
if [ "$DELTA_KO" -gt "$BUDGET_KO" ]; then
  echo "❌ Budget dépassé : $DELTA_KO Ko > $BUDGET_KO Ko."
  echo "   Soit une dépendance a été ajoutée au chemin /runtime, soit le budget"
  echo "   doit être relevé sciemment (variable BUDGET_KO)."
  exit 1
fi

# --------------------------------------------------------------------------
# Contrôle 2 : aucun code du builder dans le bundle runtime.
# C'est la raison d'être des points d'entrée séparés.
# --------------------------------------------------------------------------
FUITES=0
for MARQUEUR in "dnd-kit" "useSortable" "zustand" "produceWithPatches" "SurveyBuilder" "PropertyGrid" "ToolboxPanel"; do
  if grep -q "$MARQUEUR" dist-runtime/assets/*.js; then
    echo "❌ « $MARQUEUR » trouvé dans le bundle /runtime."
    FUITES=$((FUITES + 1))
  fi
done

if [ "$FUITES" -gt 0 ]; then
  echo ""
  echo "   Le code du builder a fuité dans le point d'entrée runtime."
  echo "   Cause habituelle : un import depuis src/runtime/** vers src/builder/**,"
  echo "   ou une ré-exportation du builder depuis src/index.ts."
  exit 1
fi

echo "✅ $DELTA_KO Ko gzip (budget $BUDGET_KO Ko), sans aucun code du builder."
