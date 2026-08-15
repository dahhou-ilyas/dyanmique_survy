# @dahhouilyas/survey

Module de sondage pour applications React : **modèle JSON**, **moteur de rendu** et
**builder en glisser-déposer**, dans un seul package à points d'entrée séparés.

Conçu pour le module de sondage décrit dans « Expression de Besoins — Module de sondage » :
questionnaires créés sans développeur depuis le back-office, stockés en JSON, interprétés
dynamiquement à l'affichage.

## Principe

> Le package ne réalise **aucun appel réseau** et ne connaît ni l'authentification, ni les
> campagnes, ni le ciblage, ni la règle du « one-shot ». Il expose un modèle, un moteur de
> rendu et un builder ; l'application hôte branche ses API sur des callbacks.

C'est la séparation « moteur de rendu (front) / logique métier (backend) » exigée par le
cahier des charges. Concrètement : campagnes, priorités, ciblage par numéro client, compteur
« plus tard » et piste d'audit restent côté application et backend.

## Installation

```bash
npm install @dahhouilyas/survey
```

`react` et `react-dom` sont des **peer dependencies** (`^18.2.0`) : le package n'embarque
jamais sa propre copie de React.

## Points d'entrée

| Import                             | Pour qui                                   | Contenu                                             |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `@dahhouilyas/survey/runtime`      | l'application qui **affiche** les sondages | `SurveyRenderer`, hooks, composants de champ        |
| `@dahhouilyas/survey/builder`      | le **back-office**                         | `SurveyBuilder`, store, éditeurs                    |
| `@dahhouilyas/survey/core`         | les deux, et le serveur                    | modèle, expressions, validation, `SurveyEngine`     |
| `@dahhouilyas/survey`              | commodité                                  | `core` + `runtime` (jamais le builder)              |
| `@dahhouilyas/survey/themes/*.css` | —                                          | `default`, `builder`, `compact`, `dark-auto`, `edb` |

Le builder n'est pas ré-exporté depuis la racine : une application qui n'importe que
`/runtime` ne télécharge ni `@dnd-kit`, ni les éditeurs de propriétés.

**Poids mesuré** : `/runtime` ajoute ≈ **29 Ko gzip** au bundle, hors React
(74,3 Ko gzip pour l'application complète, dont 45,1 Ko pour React seul).

## Afficher un sondage

```tsx
import { SurveyRenderer } from '@dahhouilyas/survey/runtime';
import '@dahhouilyas/survey/themes/default.css';

<SurveyRenderer
  definition={campagne.definition} // le JSON stocké en base
  data={reponsesPartielles} // reprise d'un sondage entamé
  locale="fr"
  onValueChanged={({ name, value }) => autosave(name, value)}
  onComplete={(result) => api.post('/sondages/reponses', result)}
/>;
```

`onComplete` reçoit un `SurveyResult` prêt pour le reporting :

```jsonc
{
  "surveyId": "srv_satisfaction",
  "schemaVersion": 1,
  "locale": "fr",
  "startedAt": "2026-08-14T09:12:03.100Z",
  "completedAt": "2026-08-14T09:14:38.900Z",
  "durationMs": 155800,
  "data": { "satisfaction": 2, "canaux": ["app", "web"] },
  "answers": [
    {
      "questionId": "q1",
      "questionName": "satisfaction",
      "type": "rating",
      "title": "Votre satisfaction globale",
      "value": 2,
      "displayValue": "2/5",
    },
  ],
}
```

`answers` est la forme « clé / valeur » attendue par le cahier des charges : à plat, avec le
libellé résolu au moment de la passation — un rapport reste lisible même après refonte du
questionnaire. Les questions **masquées** par une condition en sont exclues ; leur réponse
reste néanmoins en mémoire, pour être restaurée si l'utilisateur revient en arrière.

### Options utiles

| Prop                                                              | Effet                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `mode="display"`                                                  | tout en lecture seule — relecture d'une réponse en back-office    |
| `theme="dark"`                                                    | force le thème sombre sur ce sondage                              |
| `messages={{ next: 'Continuer' }}`                                | surcharge partielle des libellés d'interface                      |
| `components={{ ...defaultFieldComponents, signature: MonChamp }}` | ajoute ou remplace un type                                        |
| `functions={{ soldeClient: () => solde }}`                        | fonctions d'expression propres à l'hôte                           |
| `onEngineReady={(engine) => …}`                                   | accès au moteur (navigation programmatique, sauvegarde partielle) |

## Construire un sondage

```tsx
import { SurveyBuilder, createSurvey } from '@dahhouilyas/survey/builder';
import '@dahhouilyas/survey/themes/builder.css';

const [survey, setSurvey] = useState(createSurvey());

<SurveyBuilder
  value={survey}
  onChange={setSurvey}
  onSave={(definition) => api.put(`/campagnes/${id}`, definition)}
/>;
```

Cinq vues : **Concepteur** (palette, canevas, propriétés), **Aperçu**, **Logique**,
**Traductions**, **JSON**.

- Glisser-déposer à la souris **et au clavier** (`@dnd-kit`), annulation par `Ctrl+Z`.
- Le panneau de propriétés est **généré** à partir des descripteurs de types.
- L'aperçu utilise le même `SurveyRenderer` que la production : aucune divergence possible.
- Les contrôles de conception (noms dupliqués, références cassées, options vides) sont
  affichés en continu sous le canevas.

## Le modèle JSON

La forme suit celle de SurveyJS (`pages[].elements[]`, `type`, `name`, `title`, `isRequired`,
`visibleIf`, `choices`), ce qui aligne le vocabulaire sur le document remis au client et
laisse une porte de sortie dans les deux sens.

```jsonc
{
  "schemaVersion": 1,
  "id": "srv_satisfaction",
  "title": { "fr": "Satisfaction client", "en": "Customer satisfaction" },
  "settings": {
    "locale": "fr",
    "showProgressBar": "top",
    "showQuestionNumbers": "off",
    "showPageTitles": true,
    "checkErrorsMode": "onNextPage",
  },
  "calculatedValues": [
    { "name": "estDetracteur", "expression": "{recommandation} < 7", "includeIntoResult": true },
  ],
  "pages": [
    {
      "id": "p1",
      "name": "page1",
      "elements": [
        {
          "id": "q1",
          "name": "satisfaction",
          "type": "rating",
          "title": "Votre satisfaction",
          "rateMax": 5,
          "isRequired": true,
        },
        {
          "id": "q2",
          "name": "commentaire",
          "type": "comment",
          "title": "Que dire de plus ?",
          "visibleIf": "{satisfaction} <= 3",
          "isRequired": true,
        },
      ],
    },
  ],
}
```

### Types de questions

`text` (avec `inputType`: text/email/tel/url/password) · `comment` · `radiogroup` ·
`checkbox` · `dropdown` · `date` · `number` · `rating` (étoiles / nombres / émoticônes) ·
`nps` · `boolean` (radio ou interrupteur) · `html` (bloc de contenu, sans réponse) ·
`panel` (groupe, imbriquable).

Le `name` est l'identifiant unique de la question : c'est la clé de la réponse et le jeton
utilisé dans les expressions. Le builder en garantit l'unicité.

### Logique conditionnelle

`visibleIf`, `enableIf`, `requiredIf`, `choicesVisibleIf`, plus les validateurs de type
`expression`. Syntaxe compatible SurveyJS :

```
{satisfaction} <= 3
{canaux} anyof ['app', 'web'] and {segment} = 'pro'
age({date_naissance}) >= 18
{email} notempty
iif({montant} > 10000, 'eleve', 'standard')
```

Opérateurs : `= == != <> < > <= >= && and || or ! not contains notcontains anyof allof
noneof empty notempty + - * / % ^`.
Fonctions : `iif today now age year month day weekday dateAdd dateDiff sum min max avg count
abs ceil floor round trunc len upper lower trim concat isEmpty isNotEmpty`.

Les expressions sont analysées par un parseur dédié (lexer → parseur à montée en précédence
→ AST → interpréteur). **Ni `eval`, ni `new Function`** : les expressions viennent
d'utilisateurs back-office et ne doivent jamais atteindre un interpréteur JavaScript.

### Déclencheurs

`setvalue`, `copyvalue`, `skip`, `complete`. Ils se déclenchent au **passage** de la
condition à vrai, jamais tant qu'elle le reste : une valeur posée par une règle puis
corrigée par l'utilisateur n'est pas réécrasée.

## Thèmes

Les jetons sont posés sur `.edbs-root`, jamais sur `:root` : le package est une dépendance,
il ne teinte pas les variables globales de l'application. Personnaliser une charte revient à
redéfinir des variables, jamais à surcharger un sélecteur.

```css
.edbs-root {
  --edbs-color-primary: #00539b;
  --edbs-color-primary-contrast: #ffffff;
  --edbs-radius-md: 4px;
  --edbs-font-family: 'Inter', sans-serif;
}
```

`themes/edb.css` sert de gabarit. Tous les sélecteurs du package sont mono-classe et
préfixés `edbs-` : une surcharge côté hôte n'a jamais besoin de `!important`.

Le thème sombre est **explicite** (`theme="dark"` ou `data-edbs-theme="dark"`). Pour suivre
la préférence système, importer `themes/dark-auto.css` — à réserver aux applications qui
gèrent elles aussi le mode sombre.

## Accessibilité

Contrôlée automatiquement par `axe-core` (WCAG 2.1 A et AA) sur le renderer et le builder,
à chaque exécution des tests.

- `<fieldset>` / `<legend>` pour les groupes de choix et les échelles ; le `<legend>` est le
  premier enfant du `<fieldset>`, seule position où il devient le nom accessible du groupe.
- Erreurs reliées au champ par `aria-describedby`, annoncées via `role="alert"`.
- Le focus va sur la première question en erreur quand la navigation échoue, et sur le titre
  de la page à chaque changement d'étape.
- Les échelles de notation reposent sur de vrais `input[type=radio]` masqués visuellement :
  navigation par flèches et annonce de position natives.
- Glisser-déposer utilisable au clavier, avec annonces vocales en français.
- `prefers-reduced-motion` et `forced-colors` pris en compte.

## Sécurité

- Aucune évaluation dynamique de code, nulle part (`no-eval` appliqué par ESLint).
- Le HTML des blocs de contenu est assaini par DOMPurify avec une liste blanche stricte :
  ni script, ni iframe, ni attribut événementiel, ni `style`. En rendu serveur, où DOMPurify
  n'a pas de DOM, le contenu est rendu en texte brut plutôt qu'injecté.
- Aucun appel réseau : le package ne peut pas exfiltrer de données.
- Aucune ressource externe (icônes en SVG inline) : compatible avec une CSP stricte.

## Étendre le package

Un type de question = un **descripteur** et un **composant**. Le builder et le renderer ne
lisent que le registre : ni l'un ni l'autre n'a besoin d'être modifié.

```tsx
import { questionRegistry } from '@dahhouilyas/survey/core';
import { defaultFieldComponents } from '@dahhouilyas/survey/runtime';

questionRegistry.register({
  type: 'signature',
  category: 'text',
  label: { fr: 'Signature', en: 'Signature' },
  icon: 'text',
  hasValue: true,
  supportsChoices: false,
  createDefault: (name, id) => ({ id, name, type: 'signature', title: 'Signature' }),
  // Ces propriétés génèrent automatiquement le panneau d'édition du builder.
  properties: [{ name: 'penColor', label: 'Couleur du trait', editor: 'text', group: 'options' }],
  isEmpty: (value) => !value,
  getDisplayValue: (value) => (value ? 'Signé' : ''),
});

const components = { ...defaultFieldComponents, signature: SignatureField };
```

## Migration du schéma

Les définitions sont stockées en base et survivent aux montées de version. Toute évolution
incompatible incrémente `CURRENT_SCHEMA_VERSION` et ajoute une étape dans `MIGRATIONS` ; le
renderer et le builder appellent `migrateSurvey` avant toute autre opération. Une définition
produite par une version **plus récente** est refusée plutôt que traitée au mieux — la faire
tourner sur un moteur qui ignore ses nouveautés produirait des réponses silencieusement
incomplètes.

## Ce que le backend doit prévoir

Le package ne s'en occupe pas, mais expose les types que le backend doit refléter :

| Élément                                               | Type                              |
| ----------------------------------------------------- | --------------------------------- |
| Définition d'un sondage (colonne JSON de la campagne) | `SurveyDefinition`                |
| Réponse d'un utilisateur                              | `SurveyResult`                    |
| Contrôle d'un JSON reçu par API                       | `parseSurvey` / `safeParseSurvey` |
| Contrôle de conception avant publication              | `validateSurveyDefinition`        |

`@dahhouilyas/survey/core` n'a aucune dépendance à React : ces fonctions s'utilisent telles quelles
dans un service Node.

## Développement

```bash
pnpm install
pnpm dev              # bac à sable : builder + rendu, exemples satisfaction / KYC / conditions
pnpm test             # 545 tests
pnpm test:coverage    # seuils : 90 % statements, 85 % branches sur src/core
pnpm verify           # lint + typecheck + tests + build + publint + attw
```
