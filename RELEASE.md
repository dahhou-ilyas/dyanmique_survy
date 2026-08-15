# Publier `@dahhouilyas/survey`

> Le pipeline est en place, mais **aucune publication n'est automatique**. Rien ne part sur npm
> tant que vous ne lancez pas le workflow **Publish** à la main.

> [!IMPORTANT]
> **Deux identifiants voisins, à ne pas confondre.**
>
> |                   | Identifiant                 | Où il apparaît                                                        |
> | ----------------- | --------------------------- | --------------------------------------------------------------------- |
> | Compte **npm**    | `dahhouilyas` (sans tiret)  | le scope `@dahhouilyas/survey`, la portée du jeton                    |
> | Compte **GitHub** | `dahhou-ilyas` (avec tiret) | les URL du dépôt, le champ « Organization or user » de la config OIDC |
>
> Une erreur ici produit un `E404` opaque au moment du publish.

---

## 1. À faire une seule fois, avant la première publication

### 1.1 Créer le jeton npm

1. Se connecter sur [npmjs.com](https://www.npmjs.com) avec le compte **`dahhouilyas`**
   (le scope `@dahhouilyas` correspond à votre nom d'utilisateur : rien à créer).
2. **Access Tokens → Generate New Token → Granular Access Token**.
3. Réglages :

   | Champ               | Valeur                  |
   | ------------------- | ----------------------- |
   | Nom                 | `github-actions-survey` |
   | Expiration          | 90 jours (à renouveler) |
   | Packages and scopes | **Read and write**      |
   | Select packages     | `@dahhouilyas/*`        |
   | Organizations       | aucune                  |

   > Préférez un jeton **granulaire** à un jeton classique : sa portée est limitée à vos
   > packages, et son expiration est obligatoire. Un jeton « Automation » sans expiration qui
   > fuite reste valable indéfiniment.

4. Copier le jeton — il ne sera plus affiché.

### 1.2 Enregistrer le secret sur GitHub

Dépôt → **Settings → Secrets and variables → Actions → New repository secret**

| Nom         | Valeur                              |
| ----------- | ----------------------------------- |
| `NPM_TOKEN` | le jeton copié à l'étape précédente |

C'est le **seul** secret à créer. `GITHUB_TOKEN` est fourni automatiquement.

### 1.3 Autoriser les Actions à ouvrir des pull requests

Le workflow **Release** crée une PR ; sans cette autorisation, il échoue avec
`GitHub Actions is not permitted to create or approve pull requests`.

Dépôt → **Settings → Actions → General → Workflow permissions** :

- cocher **Read and write permissions** ;
- cocher **Allow GitHub Actions to create and approve pull requests**.

### 1.4 Pourquoi changesets est épinglé en 2.x

`@changesets/cli@3` et `@changesets/changelog-github@1` exigent **Node ≥ 22.11** : ils
appellent `module.enableCompileCache()`, une API absente de Node 20. Le projet étant développé
et testé sur Node 20, la version 3 échoue à la fois en CI et en local, avec :

```
TypeError: enableCompileCache is not a function
```

Le projet reste donc sur `@changesets/cli@^2.31.1`, qui fonctionne sur Node 20 **et** 22.

Le générateur de CHANGELOG est celui par défaut (`@changesets/cli/changelog`), et non
`@changesets/changelog-github`, pour deux raisons : ce dernier exige un `GITHUB_TOKEN` même
en local, et il produit des liens vers les commits et les pull requests d'un dépôt **privé** —
liens morts pour quiconque installe le package public.

> Si vous passez un jour votre poste en Node 22, vous pourrez remonter changesets en 3.x et,
> au passage, dépingler `jsdom` (bloqué en 29.x pour la même raison).

### 1.5 Vérifier le nom de la branche

Les workflows visent `master`, qui est bien la branche de ce dépôt. Si vous la renommez en
`main`, il faut mettre à jour trois endroits : `.github/workflows/ci.yml`,
`.github/workflows/release.yml` et le champ `baseBranch` de `.changeset/config.json`.

---

## 2. Le cycle de publication

```
  Vous développez
        │
        ├──▶  pnpm changeset          décrire la modification et son impact
        │                             (patch / minor / major)
        │
        ├──▶  git push                ──▶  CI : lint, types, 561 tests,
        │                                       build, publint, attw,
        │                                       installation dans un projet
        │                                       React 18 vierge, budget de taille
        │
        │                             ──▶  Release : ouvre ou met à jour la PR
        │                                            « chore: préparer la prochaine version »
        │
        ├──▶  fusionner cette PR      les versions et le CHANGELOG sont figés
        │
        └──▶  Actions → Publish       DÉCLENCHEMENT MANUEL
                    │
                    ├── Simulation ✔  (par défaut) montre ce qui serait publié
                    └── Simulation ✘  publie réellement, pose le tag git
                                      et crée la release GitHub
```

### 2.1 Décrire une modification

Après chaque changement qui mérite une version :

```bash
pnpm changeset
```

L'outil demande le niveau d'impact, puis un résumé. Il écrit un fichier dans `.changeset/`,
que vous commitez avec votre code.

| Niveau  | Quand                            | Exemple                               |
| ------- | -------------------------------- | ------------------------------------- |
| `patch` | correction sans changement d'API | un message d'erreur corrigé           |
| `minor` | ajout rétrocompatible            | un nouveau type de question           |
| `major` | rupture de compatibilité         | une prop renommée, un export supprimé |

> Tant que la version est en `0.x`, npm considère **toute** version mineure comme
> potentiellement cassante. C'est confortable pendant la stabilisation ; passez en `1.0.0`
> dès qu'une application tierce dépend du package.

### 2.2 Publier

1. Onglet **Actions → Publish — npm → Run workflow**.
2. Laisser **Simulation** cochée pour le premier essai. Le job affiche le contenu exact du
   paquet sans rien envoyer.
3. Relancer avec **Simulation décochée** pour publier.

Le workflow refuse de publier si la version existe déjà sur npm — le contrôle a lieu **avant**
la création du tag git, pour ne pas laisser un tag orphelin derrière lui.

### 2.3 Publier une préversion

L'entrée **Étiquette** accepte `next` et `beta`. Une version publiée sous une étiquette autre
que `latest` n'est pas installée par défaut :

```bash
npm install @dahhouilyas/survey          # installe la dernière « latest »
npm install @dahhouilyas/survey@next     # installe explicitement la préversion
```

---

## 3. Ce que la CI vérifie

| Job             | Contrôle                                                                            |
| --------------- | ----------------------------------------------------------------------------------- |
| **quality**     | ESLint, Prettier, `tsc --noEmit` sur les deux projets                               |
| **test**        | 561 tests sur Node 20 **et** 22, avec seuils de couverture sur `src/core`           |
| **package**     | build ESM + CJS + `.d.ts`, `publint`, `@arethetypeswrong/cli`, build du bac à sable |
| **consumer**    | **installe le tarball dans un projet React 18 neuf**, hors du monorepo              |
| **bundle-size** | mesure l'apport de `/runtime` et refuse le code du builder dans ce bundle           |

Les deux derniers méritent un mot, car ils sont inhabituels.

**`consumer`** installe réellement le `.tgz` dans un projet vierge, puis en vérifie le
typecheck, le build, l'import en CJS **et** en ESM depuis Node, et l'absence d'une seconde
copie de React. C'est le seul job capable d'attraper un champ `exports` incomplet, un fichier
oublié dans `files` ou une dépendance mal déclarée : à l'intérieur du monorepo, tout se résout
depuis les sources et ces défauts restent invisibles.

**`bundle-size`** construit deux applications — React seul, puis React + `/runtime` — et
compare les tailles gzip. Il échoue au-delà de **40 Ko** d'apport (mesuré à 28 Ko aujourd'hui)
et si un marqueur du builder (`dnd-kit`, `zustand`, `SurveyBuilder`…) apparaît dans le bundle
runtime. C'est la seule garde qui protège la promesse des points d'entrée séparés : une
régression de ce type ne casse aucun test, elle se contente de tripler le poids du bundle de
l'application cliente.

### Reproduire la CI en local

```bash
pnpm verify
```

Cette commande enchaîne exactement ce que fait la CI, **dans le même ordre** :

```
pnpm install --frozen-lockfile   ← attrape un pnpm-lock.yaml désynchronisé
pnpm lint
pnpm format:check
pnpm typecheck
pnpm changeset status            ← attrape une chaîne de release cassée
pnpm test
pnpm build
publint && attw --pack .
```

Le premier maillon est celui qu'on oublie : après avoir renommé un package ou ajouté une
dépendance, `pnpm-lock.yaml` doit être régénéré **et commité**. En local, les commandes
continuent de fonctionner avec le `node_modules` déjà installé ; en CI, `--frozen-lockfile`
refuse de partir et l'installation échoue avec `ERR_PNPM_OUTDATED_LOCKFILE`.

Les deux scripts d'intégration sont dans `.github/scripts/` et **s'exécutent tels quels en
local** :

```bash
pnpm build
cd packages/survey && npm pack --pack-destination ../.. && cd ../..
mkdir -p tarball && mv *.tgz tarball/
bash .github/scripts/consumer-smoke-test.sh
bash .github/scripts/bundle-size-check.sh
```

---

## 4. Passer au « trusted publishing » (OIDC) plus tard

npm permet depuis juillet 2025 de publier **sans aucun jeton**, en authentifiant directement
le workflow GitHub par OpenID Connect. C'est nettement plus sûr : plus rien à stocker, à faire
tourner ni à révoquer.

**Pourquoi ce n'est pas ce que fait le pipeline aujourd'hui**, malgré l'intérêt évident :

1. La configuration se fait dans les **réglages du package** sur npmjs.com — elle suppose donc
   que le package **existe déjà**. La toute première publication passe forcément par un jeton.
2. `pnpm` 11 souffre d'une régression sur la publication OIDC ([pnpm#11513]), et
   `changesets/action` a des difficultés connues avec les packages scopés ([npm/cli#8976]).
   Le workflow contourne les deux en publiant avec `npm publish` plutôt qu'avec pnpm ou
   changesets — il est donc déjà prêt pour la bascule.
3. La provenance exige un dépôt **public** ; le vôtre est privé, et le workflow désactive
   l'attestation en conséquence.

**Quand basculer** — une fois la version `0.1.0` publiée :

1. npmjs.com → page du package → **Settings → Trusted Publisher → GitHub Actions**

   | Champ                | Valeur            |
   | -------------------- | ----------------- |
   | Organization or user | `dahhou-ilyas`    |
   | Repository           | `dyanmique_survy` |
   | Workflow filename    | `publish.yml`     |
   | Allowed actions      | `npm publish`     |

2. Dans `.github/workflows/publish.yml`, supprimer les deux lignes du jeton :

   ```diff
     - name: Publier
       working-directory: packages/survey
       run: npm publish --access public --tag "${{ inputs.tag }}" ${{ steps.provenance.outputs.flag }}
   -   env:
   -     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

   `permissions: id-token: write` est déjà présent, et Node 22 avec npm à jour est déjà
   configuré : il n'y a rien d'autre à changer.

3. Supprimer le secret `NPM_TOKEN` de GitHub.

Avec le trusted publishing, la provenance est générée automatiquement — le drapeau
`--provenance` devient inutile, mais reste sans effet néfaste.

[pnpm#11513]: https://github.com/pnpm/pnpm/issues/11513
[npm/cli#8976]: https://github.com/npm/cli/issues/8976

---

## 5. En cas de problème

| Symptôme                                                             | Cause et remède                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `E402 Payment Required`                                              | Le package scopé est traité comme privé. Vérifier `publishConfig.access = "public"` dans `packages/survey/package.json`.                       |
| `E403 Forbidden`                                                     | Jeton expiré, révoqué, ou sans droit d'écriture sur `@dahhouilyas/*`. Régénérer et remplacer le secret.                                        |
| `E404` sur un scope                                                  | Le scope ne vous appartient pas. `@dahhouilyas` correspond à votre nom d'utilisateur npm : vérifier que vous êtes connecté avec **ce** compte. |
| `You cannot publish over the previously published versions`          | La version existe déjà. Fusionner la PR de version pour l'incrémenter.                                                                         |
| `GitHub Actions is not permitted to create or approve pull requests` | Cocher l'option décrite en 1.3.                                                                                                                |
| Provenance en échec                                                  | Le dépôt est privé. Soit le rendre public, soit laisser le workflow désactiver l'attestation — il le fait tout seul.                           |
| `ERR_PNPM_OUTDATED_LOCKFILE`                                         | `pnpm-lock.yaml` n'est pas à jour. Lancer `pnpm install` en local et commiter le lockfile.                                                     |

### Retirer une version publiée

`npm unpublish` n'est autorisé que dans les **72 heures** suivant la publication, et un numéro
de version consommé ne peut **jamais** être réutilisé. Au-delà, la seule option est :

```bash
npm deprecate @dahhouilyas/survey@0.1.0 "Version retirée, utilisez la 0.1.1"
```

C'est précisément pour cette irréversibilité que la publication est manuelle et que la
simulation est activée par défaut.
