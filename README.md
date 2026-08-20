# sondageBuilder

Monorepo du **module de sondage** : le package `@dahhouilyas/survey` et son bac à sable.

| Dossier           | Rôle                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `packages/survey` | le package publié — [documentation complète](./packages/survey/README.md)                 |
| `apps/playground` | bac à sable Vite : builder et rendu côte à côte, exemples satisfaction / KYC / conditions |

## Périmètre

Le cahier des charges `EDB KYC v1.docx` décrit un module complet : campagnes, ciblage par
numéro client, priorités, affichage interstitiel après authentification, « one-shot »,
compteur d'ignorance, piste d'audit.

**Ce dépôt ne couvre que le package front autonome** — modèle JSON, moteur de rendu et
builder — conçu pour être consommé comme dépendance :

```jsonc
// package.json du projet parent
{
  "dependencies": {
    "@dahhouilyas/survey": "^0.1.0",
  },
}
```

Tout le reste (campagnes, ciblage, one-shot, priorité, APIs, piste d'audit) appartient au
projet parent et à son backend. Le package ne fait **aucun appel réseau** : il expose
`onComplete` et `onValueChanged` comme points de branchement. C'est la séparation
« moteur de rendu (front) / logique métier (backend) » exigée par le document.

## Démarrer

```bash
pnpm install
pnpm dev        # bac à sable sur http://localhost:5173
```

## Commandes

| Commande                    | Effet                                                 |
| --------------------------- | ----------------------------------------------------- |
| `pnpm dev`                  | lance le bac à sable                                  |
| `pnpm test`                 | suite de tests du package                             |
| `pnpm test:coverage`        | couverture, avec seuils sur `src/core`                |
| `pnpm lint` / `pnpm format` | ESLint (flat config) / Prettier                       |
| `pnpm typecheck`            | `tsc --noEmit` sur tous les projets                   |
| `pnpm build`                | construit le package (ESM + CJS + `.d.ts` + thèmes)   |
| `pnpm verify`               | lint + typecheck + tests + build + `publint` + `attw` |
| `pnpm changeset`            | prépare une note de version                           |
| `pnpm release`              | build puis publication                                |

## Choix techniques structurants

- **TypeScript 6**, pas 7 : le compilateur natif de TS 7 n'expose pas encore d'API
  programmatique stable, dont dépendent `typescript-eslint` et la génération des
  déclarations. À revoir quand TS 7.1 sera disponible.
- **Un seul package, plusieurs points d'entrée** : `/element` (Web Component, tout framework
  ou aucun), `/runtime` (React), `/headless` (votre propre interface), `/builder` (back-office),
  `/core` (modèle et moteur, utilisable côté serveur). Le builder et ses dépendances
  (`@dnd-kit`, `zustand`, `immer`, `zod`) n'entrent jamais dans le bundle client —
  [vérifié par la mesure](./packages/survey/README.md#points-dentrée).
- **Le moteur ne dépend pas de React** : `core` ne l'importe pas une seule fois. C'est ce qui
  a permis d'ajouter un mode headless et un Web Component autonome de 41 Ko sans réécrire un
  seul composant de champ — l'entrée `/element` alias React vers Preact au build.
- **Pas de CSS-in-JS, pas de Tailwind dans le package** : des variables CSS sur `.edbs-root`,
  qui n'imposent aucune configuration à l'application hôte et ne teintent pas ses styles.
- **Aucune évaluation dynamique de code** : les expressions conditionnelles passent par un
  parseur maison (lexer → AST → interpréteur), jamais par `eval`.
- **`jsdom` épinglé en 29.x** : la 30 exige Node ≥ 22, l'environnement de développement est
  en Node 20.19.

## Publication

Le package est publié sur npm sous le nom **`@dahhouilyas/survey`**, licence MIT.

```bash
npm install @dahhouilyas/survey
```

Trois workflows GitHub Actions couvrent le cycle :

| Workflow      | Déclencheur          | Rôle                                                                                                                   |
| ------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`      | push et pull request | lint, types, tests Node 20/22, build, `publint`, `attw`, installation dans un projet React 18 vierge, budget de taille |
| `release.yml` | push sur `master`    | maintient la pull request « Version Packages » — **ne publie pas**                                                     |
| `publish.yml` | **manuel**           | publie sur npm, pose le tag git et crée la release GitHub                                                              |

Aucune publication n'est automatique : le workflow `publish.yml` se lance à la main, et sa
simulation est active par défaut. Une version npm est irréversible — `npm unpublish` n'est
autorisé que 72 heures, et un numéro consommé ne se réutilise jamais.

**La procédure complète est dans [`RELEASE.md`](./RELEASE.md)** : création du jeton npm,
secrets à enregistrer, réglages GitHub, cycle de version, et la marche à suivre pour passer
plus tard au « trusted publishing » OIDC (publication sans jeton).
