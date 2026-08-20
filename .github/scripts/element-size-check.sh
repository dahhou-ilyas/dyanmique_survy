#!/usr/bin/env bash
#
# Contrôle le poids de `element.js`, le bundle autonome du Web Component.
#
# Ce fichier est chargé par une balise <script> : son poids est payé intégralement
# par chaque page qui l'utilise, sans partage possible avec le reste de
# l'application. Une régression n'y casse aucun test — elle alourdit simplement
# tout le monde, en silence.
#
# Second contrôle : le bundle doit être VRAIMENT autonome. S'il redevenait
# dépendant de React, il pèserait dix fois plus et cesserait de fonctionner
# derrière une simple balise <script>.
#
set -euo pipefail

BUDGET_KO=${BUDGET_KO:-45}
BUNDLE="packages/survey/dist/element.js"

if [ ! -f "$BUNDLE" ]; then
  echo "❌ $BUNDLE introuvable. Lancez d'abord : pnpm build"
  exit 1
fi

TAILLE_O=$(gzip -c "$BUNDLE" | wc -c | tr -d ' ')
TAILLE_KO=$((TAILLE_O / 1024))
BRUT_KO=$(($(wc -c < "$BUNDLE") / 1024))

echo ""
echo "┌────────────────────────────────────────────┐"
printf "│ element.js  %6s Ko brut  %5s Ko gzip │\n" "$BRUT_KO" "$TAILLE_KO"
printf "│ budget                       %5s Ko gzip │\n" "$BUDGET_KO"
echo "└────────────────────────────────────────────┘"
echo ""

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Taille du Web Component"
    echo ""
    echo "| Mesure | Taille |"
    echo "|---|---|"
    echo "| \`element.js\` brut | $BRUT_KO Ko |"
    echo "| **gzip** | **$TAILLE_KO Ko** |"
    echo "| Budget | $BUDGET_KO Ko gzip |"
  } >> "$GITHUB_STEP_SUMMARY"
fi

# --------------------------------------------------------------------------
# Contrôle 1 : le budget.
# --------------------------------------------------------------------------
if [ "$TAILLE_KO" -gt "$BUDGET_KO" ]; then
  echo "❌ Budget dépassé : $TAILLE_KO Ko > $BUDGET_KO Ko."
  echo "   Cause la plus probable : une dépendance lourde a rejoint le chemin"
  echo "   du composant. Zod avait coûté 60 Ko à lui seul avant d'en être retiré."
  exit 1
fi

# --------------------------------------------------------------------------
# Contrôle 2 : autonomie. React ne doit jamais y revenir.
# --------------------------------------------------------------------------
FUITES=0
for MARQUEUR in "__SECRET_INTERNALS" "Minified React error" "scheduler"; do
  if grep -qF "$MARQUEUR" "$BUNDLE"; then
    echo "❌ « $MARQUEUR » trouvé : React a remplacé Preact dans le bundle."
    FUITES=$((FUITES + 1))
  fi
done

# Preact doit, lui, être bien présent : `__k` est la propriété interne de ses
# vnodes et survit à la minification.
if ! grep -qF "__k" "$BUNDLE"; then
  echo "❌ Aucune trace de Preact — l'alias du build n'a pas été appliqué."
  FUITES=$((FUITES + 1))
fi

# --------------------------------------------------------------------------
# Contrôle 3 : le code du builder n'a rien à faire ici.
# --------------------------------------------------------------------------
for MARQUEUR in "dnd-kit" "useSortable" "produceWithPatches"; do
  if grep -qF "$MARQUEUR" "$BUNDLE"; then
    echo "❌ « $MARQUEUR » trouvé : le builder a fuité dans le composant."
    FUITES=$((FUITES + 1))
  fi
done

[ "$FUITES" -eq 0 ] || exit 1

echo "✅ $TAILLE_KO Ko gzip (budget $BUDGET_KO Ko), autonome et sans code du builder."
