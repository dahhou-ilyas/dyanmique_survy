# Analyse du projet et pistes d'évolution

> Document de travail, août 2026. Il fait trois choses : un état des lieux honnête de ce qui
> existe, un positionnement face au marché, et une liste d'idées **classées par degré réel de
> nouveauté** — parce qu'annoncer comme « innovant » ce que tout le monde fait déjà est le
> meilleur moyen de perdre la confiance d'un comité de pilotage.

---

## 1. État des lieux

### 1.1 Ce qui existe

| Brique                               | Volume                  | Maturité                            |
| ------------------------------------ | ----------------------- | ----------------------------------- |
| `core` — modèle, expressions, moteur | 5 221 lignes            | solide, 91–98 % de couverture       |
| `builder` — concepteur               | 3 046 lignes            | fonctionnel, DnD souris + clavier   |
| `runtime` — rendu React              | 1 703 lignes            | solide, WCAG 2.1 AA vérifié         |
| `styles`                             | 1 962 lignes            | 5 thèmes, variables CSS             |
| tests                                | 3 725 lignes, 561 tests | bon sur `core`, plus léger sur l'UI |

11 types de questions, 3 points d'entrée, 28 Ko gzip pour le runtime hors React.

### 1.2 Les vraies forces — et elles ne sont pas où on croit

La valeur du projet n'est pas « un builder de sondage de plus ». Elle tient à quatre
propriétés d'architecture que **presque aucun concurrent ne réunit** :

**a) Le moteur est du TypeScript pur, sans React.** `SurveyEngine` tourne dans Node. C'est
vérifié en CI par un test qui l'importe en CJS _et_ en ESM. Conséquence sous-exploitée : la
même logique de visibilité, d'obligation et de validation peut s'exécuter **côté serveur**.

**b) Les expressions sont un AST, pas des chaînes.** `parseExpression` produit un arbre
inspectable. On sait déjà répondre à « de quoi dépend cette règle ? » (`collectReferences`) et
« quelles fonctions appelle-t-elle ? » (`collectFunctionCalls`). C'est une porte ouverte sur
toute une classe d'analyses statiques que personne n'exploite.

**c) Aucun appel réseau, aucune ressource externe.** Les données ne sortent jamais du système
d'information. Pour une banque, ce n'est pas un détail de conception : c'est ce qui rend le
module utilisable là où un SaaS est disqualifié d'office.

**d) L'accessibilité est vérifiée par la machine.** axe-core tourne sur le renderer et le
builder à chaque exécution des tests. Ce n'est pas une déclaration d'intention, c'est un test
qui casse la CI.

### 1.3 Les angles morts, sans complaisance

| Manque                               | Gravité            | Pourquoi c'est gênant                                                                                             |
| ------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Pas de re-validation serveur         | **élevée**         | Un client peut forger un POST et contourner toute obligation. Aujourd'hui le backend n'a aucun moyen de vérifier. |
| Types de questions limités           | moyenne            | Ni matrice, ni panel répétable, ni upload, ni signature. Un dossier KYC réel en a besoin.                         |
| Couverture UI plus faible que `core` | moyenne            | `builder/layout` à 40 %, `builder/tabs` à 76 %.                                                                   |
| `.d.ts` de 284 Ko                    | faible mais réelle | L'inférence Zod s'inline dans les déclarations et ralentit le `tsc` des consommateurs.                            |
| Pas de rendu imprimable / PDF        | moyenne            | Un questionnaire réglementaire doit pouvoir être archivé sous forme lisible.                                      |
| Une seule direction de texte         | faible aujourd'hui | Les propriétés logiques CSS sont là, mais le RTL n'a jamais été testé.                                            |
| Pas d'analytique de réponses         | moyenne            | Le package produit un `SurveyResult` et s'arrête là.                                                              |

---

## 2. Où l'on se situe face au marché

|                             | SurveyJS                | Form.io     | Typeform     | **Ce projet**   |
| --------------------------- | ----------------------- | ----------- | ------------ | --------------- |
| Builder                     | payant, par développeur | open source | SaaS         | **inclus, MIT** |
| Données hébergées           | chez vous               | chez vous   | **chez eux** | chez vous       |
| Moteur réutilisable serveur | non                     | partiel     | non          | **oui**         |
| Expressions sans `eval`     | oui                     | oui         | s.o.         | oui             |
| A11y vérifiée en CI         | non documenté           | non         | non          | **oui**         |
| Types de questions          | ~30                     | ~30         | ~25          | **11**          |
| Analytique                  | module payant           | non         | oui          | **non**         |

Lecture honnête : **on est devant sur l'architecture et la licence, derrière sur la richesse
fonctionnelle.** La stratégie qui en découle n'est pas de courir après les 30 types de
questions de SurveyJS — course perdue d'avance à effectif comparable — mais d'aller là où
l'architecture donne un avantage que les autres ne peuvent pas copier sans se réécrire.

---

## 3. Famille A — Le rattrapage nécessaire

Rien d'innovant ici. Ce sont des attentes de base, et leur absence se remarque en démonstration.

| #   | Sujet                              | Effort | Note                                                                                            |
| --- | ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| A1  | Panel dynamique (groupe répétable) | ~3 j   | Indispensable : « ajoutez chaque bénéficiaire effectif ».                                       |
| A2  | Matrice simple et dynamique        | ~4 j   | Le plus demandé après le panel répétable.                                                       |
| A3  | Upload de fichier                  | ~2 j   | Le composant seulement ; le stockage reste à l'hôte, cohérent avec le principe « zéro réseau ». |
| A4  | Signature manuscrite               | ~2 j   | Canvas → image base64. Fort besoin en KYC.                                                      |
| A5  | Curseur, classement                | ~2 j   | Peu coûteux, complète le set.                                                                   |
| A6  | Éditeur de thème dans le builder   | ~3 j   | Les jetons CSS existent déjà ; il ne manque que l'interface.                                    |

**Recommandation : A1 et A4 d'abord.** Les deux sont directement appelés par un dossier KYC ;
les autres peuvent attendre.

---

## 4. Famille B — La différenciation

Des choses que peu font, et que notre architecture rend faciles alors qu'elles sont
coûteuses ailleurs.

### B1 — Re-validation serveur avec le même moteur ⭐

**Le manque le plus grave du projet, et un angle mort du marché entier.**

Aujourd'hui, le backend reçoit un `SurveyResult` et n'a **aucun moyen** de vérifier qu'il est
cohérent avec la définition. Un client malveillant peut :

- omettre une question obligatoire,
- répondre à une question qui aurait dû rester masquée,
- envoyer une valeur hors des bornes,
- inventer un `questionName`.

SurveyJS documente explicitement qu'il ne traite pas ce problème : _« SurveyJS focuses on
providing guidance rather than enforcing server-side protections »_. La demande est ouverte
chez eux depuis 2019 ([issue #1340](https://github.com/surveyjs/survey-library/issues/1340)).

Nous, nous avons déjà tout : le moteur est du TypeScript pur qui tourne dans Node.

```ts
import { verifySubmission } from '@dahhouilyas/survey/core';

const verdict = verifySubmission(definition, payload.answers, {
  now: new Date(payload.completedAt),
});

if (!verdict.valid) {
  // verdict.violations : [
  //   { kind: 'answered-hidden-question', questionName: 'employeur' },
  //   { kind: 'missing-required',         questionName: 'origine_fonds' },
  //   { kind: 'unknown-question',         questionName: 'injecte' },
  //   { kind: 'value-out-of-range',       questionName: 'age', min: 18, max: 120 },
  // ]
  return res.status(422).json(verdict.violations);
}
```

**Effort : ~4 jours.** Le gros est écrit ; il s'agit d'exposer une API de vérification qui
rejoue la cascade de visibilité et la validation sur des réponses figées, puis compare.

**Pourquoi c'est un vrai différenciateur :** pour un établissement financier, un formulaire
dont le backend ne peut pas vérifier les règles est inauditable. C'est l'argument qui fait
basculer un choix d'architecture, pas un confort de développeur.

### B2 — Génération de types à partir d'une définition ⭐

Il existe des générateurs de types pour GraphQL, pour Supabase, pour Sanity. **Aucun pour une
définition de formulaire.**

```bash
npx survey-codegen campagne-kyc.json > kyc.types.ts
```

```ts
// kyc.types.ts — généré
export interface KycAnswers {
  date_naissance: string;
  situation_pro: 'salarie' | 'independant' | 'retraite' | 'etudiant' | 'sans';
  employeur?: string; // conditionnelle → optionnelle
  revenu_annuel: number;
  origine_fonds: Array<'salaire' | 'epargne' | 'immobilier' | 'heritage'>;
  ppe: boolean;
  ppe_precisions?: string;
}
```

Le backend devient **typé contre le questionnaire**. Renommez une question dans le builder,
régénérez, et le compilateur signale chaque endroit du backend à corriger.

**Effort : ~3 jours.** L'information est entièrement dans le modèle : `name`, `choices`,
`isRequired`, `visibleIf`. Un `visibleIf` non vide ⇒ propriété optionnelle.

### B3 — Analyse statique du questionnaire ⭐

Nous validons déjà la syntaxe et les références (`validateSurveyDefinition`). L'AST permet
d'aller beaucoup plus loin — vers ce qu'un compilateur fait d'un programme.

| Diagnostic               | Question posée                                                             |
| ------------------------ | -------------------------------------------------------------------------- |
| Question inatteignable   | Existe-t-il un chemin de réponses menant à son affichage ?                 |
| Condition contradictoire | `{age} > 60 and {age} < 30` — jamais vraie.                                |
| Obligation impossible    | Question obligatoire dont la condition d'affichage exclut toute saisie.    |
| Chemins morts            | Une page dont aucune combinaison ne permet de sortir.                      |
| Complexité               | « 47 chemins distincts, profondeur maximale 6 » — un signal de conception. |

Un questionnaire est un programme ; personne ne le traite comme tel. SurveyJS ne fait aucune
de ces analyses.

**Effort : ~5 jours** pour les cas décidables simplement (intervalles numériques, égalités sur
ensembles finis). Une version complète demanderait un solveur SMT — hors sujet ici.

### B4 — Rejeu de session

Le moteur émet déjà des événements (`valueChanged`, `pageChanged`, `validationFailed`).
Les enregistrer donne un **journal rejouable** :

- le support voit exactement ce que le client a fait, sans lui demander de raconter ;
- un bug se reproduit en rejouant le journal dans un test ;
- l'auteur du questionnaire voit où les gens abandonnent.

**Effort : ~3 jours.** L'infrastructure d'événements existe ; il manque l'enregistreur, le
format sérialisé et le rejoueur.

### B5 — Rendu imprimable et archivable

Un questionnaire réglementaire doit pouvoir être conservé sous forme lisible pendant des
années. Un mode `print` — questions et réponses, sans interactif, avec les libellés résolus —
plus une feuille `@media print`.

**Effort : ~2 jours.**

---

## 5. Famille C — Ce que je n'ai trouvé nulle part

Quatre idées pour lesquelles je n'ai identifié aucune implémentation existante, dans aucun
produit du marché. Elles ont un point commun : elles ne sont réalisables que parce que le
moteur est pur, que les expressions sont un AST, et que rien ne sort du système d'information.

### C1 — Attestation d'affichage signée 🔷

**Le problème que personne ne traite.** Trois ans après une souscription, un client conteste :
« on ne m'a jamais posé cette question », ou « la formulation n'était pas celle-là ». Que
produit la banque ? Aujourd'hui : une ligne en base avec des réponses. Aucune preuve du
**libellé exact affiché**, ni de la langue, ni de la version du questionnaire.

**La proposition.** À la complétion, le moteur produit une attestation :

```jsonc
{
  "surveyId": "kyc_2026",
  "definitionHash": "sha256:9f2c...", // empreinte de la définition EXACTE affichée
  "schemaVersion": 1,
  "locale": "fr",
  "renderedQuestions": [
    {
      "name": "ppe",
      "title": "Exercez-vous une fonction politique importante ?",
      "titleHash": "sha256:4a1e...",
      "shownAt": "2026-08-20T09:12:03Z",
    },
  ],
  "answers": [/* … */],
  "engineVersion": "0.1.0",
}
```

L'hôte signe ce document avec sa clé. La banque peut alors **prouver** ce qui a été affiché,
dans quelle langue, avec quelle version du moteur.

**Pourquoi personne ne le fait :** les SaaS ne peuvent pas — la définition vit chez eux et
change sans trace côté client. Les bibliothèques UI ne s'estiment pas concernées. Il faut un
moteur qui connaisse à la fois la définition, le rendu et le résultat — c'est notre cas.

**Effort : ~4 jours.** Le hachage de définition est trivial ; le suivi des questions
réellement affichées demande un peu de travail dans la cascade du moteur.

### C2 — Questionnaire différentiel pour le pKYC 🔷

**Le contexte réglementaire.** 2026 marque le basculement du KYC périodique vers le **KYC
perpétuel** — événementiel, continu, déclenché par un changement de situation plutôt que par
un calendrier. Les régulateurs sont passés de « avez-vous des contrôles ? » à « prouvez qu'ils
sont efficaces ».

Or le cahier des charges du client décrit un modèle **par campagnes** : on cible une
population, on affiche un questionnaire, on recommence l'an prochain. C'est le modèle d'hier.

**La proposition.** Le moteur sait déjà, grâce au graphe de dépendances, quelles réponses
influent sur quelles questions. On peut donc calculer un **delta** :

```ts
const delta = computeDelta(definition, {
  previousAnswers: dossierClient.dernieresReponses,
  knownData: { adresse: coreBanking.adresse, revenu: coreBanking.revenu },
  staleAfter: { revenu_annuel: '12 months', ppe: '24 months' },
  triggeredBy: 'address-change',
});

// delta.questionsToAsk : ['adresse_confirmee', 'origine_fonds']
// delta.reason        : { adresse_confirmee: 'changed-in-source-system',
//                         origine_fonds:     'depends-on: adresse' }
```

Le client ne revoit **que** ce qui a changé ou périmé — trois questions au lieu de trente. Et
la banque dispose de la justification, question par question, de ce qu'elle a redemandé et
pourquoi.

**Pourquoi personne ne le fait :** cela suppose que le moteur comprenne les dépendances entre
questions _et_ accepte un état antérieur comme entrée. Aucun builder de formulaire ne modélise
la notion de « réponse périmée ». C'est un concept de gestion du cycle de vie client, pas de
formulaire — et c'est précisément le croisement qui manque au marché.

**Effort : ~6 jours.** C'est l'idée la plus ambitieuse de la liste, et de loin la plus
défendable devant un client bancaire en 2026.

### C3 — Provenance de chaque réponse 🔷

**Le problème.** Dans un dossier réglementaire, ces trois situations n'ont pas la même valeur
juridique et sont pourtant stockées de façon identique :

1. le client a saisi la réponse lui-même ;
2. la réponse était pré-remplie depuis le SI et il l'a confirmée sans y toucher ;
3. la réponse était pré-remplie et il l'a **modifiée**.

Le troisième cas est un signal fort — le client contredit la donnée de la banque. Aucune
bibliothèque de formulaire ne le distingue.

**La proposition.** Enrichir `SurveyAnswer` :

```ts
{
  questionName: 'revenu_annuel',
  value: 45000,
  provenance: 'prefilled-modified',    // 'user' | 'prefilled-confirmed' | 'prefilled-modified'
  prefilledValue: 38000,               // ce que le SI affirmait
  interactions: 3,                     // nombre de changements avant validation
  timeToAnswerMs: 42000
}
```

**Pourquoi c'est nouveau, et pourquoi c'est délicat.** Les champs `interactions` et
`timeToAnswerMs` transforment le formulaire en capteur : une hésitation prolongée sur
« origine des fonds » est un signal exploitable en analyse de risque. C'est puissant et
intrusif. **Il faut donc que ce soit désactivé par défaut, documenté, et soumis à une analyse
d'impact RGPD avant tout usage.** Je le propose parce que c'est réellement nouveau, pas parce
que c'est anodin.

**Effort : ~3 jours** pour la provenance seule, ~5 avec la télémétrie d'interaction.

### C4 — Contrôle de lisibilité et de charge cognitive 🔷

**Le problème.** Les questionnaires bancaires sont écrits par des juristes. Le résultat est
illisible, et depuis juin 2025 l'**European Accessibility Act** s'applique aux services
financiers : les premières plaintes ont été déposées en France en novembre 2025, avec des
amendes allant de 60 000 € en Irlande à environ 900 000 € en Suède.

L'accessibilité technique (WCAG 2.1 AA) est déjà vérifiée chez nous. Mais l'accessibilité
**cognitive** — la compréhensibilité du texte — ne l'est nulle part.

**La proposition.** Un contrôle en direct dans le builder, à côté des diagnostics existants :

```
⚠ « ppe » — phrase de 34 mots, indice de lisibilité 28/100 (très difficile)
  Suggestion : scinder en deux questions.

⚠ « origine_fonds » — 4 termes de jargon détectés : « bénéficiaire effectif »,
  « personne politiquement exposée », « diligence raisonnable », « faisceau d'indices ».

⚠ Page 2 — 14 questions obligatoires d'affilée. Au-delà de 7, le taux d'abandon
  augmente fortement.

✓ Contraste du thème : 7,1:1 — conforme AA et AAA.
```

Tout est calculable **hors ligne**, sans IA : indice de lisibilité adapté au français (type
Kandel-Moles), lexique de jargon bancaire maintenu dans le package, comptage de charge par
page, contraste calculé depuis les jetons CSS.

**Pourquoi personne ne le fait :** les builders de formulaires traitent le texte comme une
chaîne opaque. Aucun ne considère la _rédaction_ comme un objet à valider. Or c'est exactement
là que se situe le risque réglementaire de 2026.

**Effort : ~4 jours.** Le lexique de jargon est le vrai travail, et il doit être co-construit
avec la conformité — ce qui en fait aussi un excellent prétexte de collaboration avec le métier.

---

## 6. Le fil rouge

Les quatre idées de la famille C ne sont pas un catalogue. Elles disent toutes la même chose :

> **Un questionnaire réglementaire n'est pas un formulaire. C'est un acte, qui doit être
> prouvable, vérifiable, minimal et compréhensible.**

| Idée                            | Propriété visée                                             |
| ------------------------------- | ----------------------------------------------------------- |
| C1 — attestation signée         | **prouvable** — on peut démontrer ce qui a été affiché      |
| B1 — re-validation serveur      | **vérifiable** — le backend ne fait pas confiance au client |
| C2 — questionnaire différentiel | **minimal** — on ne redemande que le nécessaire             |
| C4 — contrôle de lisibilité     | **compréhensible** — le client a réellement compris         |

Aucun concurrent ne peut suivre sur ces quatre axes sans refaire son architecture : il faut un
moteur pur, exécutable des deux côtés, avec des règles inspectables et zéro dépendance réseau.

C'est ça, le positionnement défendable — pas « un builder de plus, mais gratuit ».

---

## 7. Séquencement proposé

**Étape 1 — combler le trou de sécurité (2 semaines)**
`B1` re-validation serveur, `A1` panel dynamique, `A4` signature.
Sans B1, le module n'est pas défendable devant un RSSI.

**Étape 2 — l'argument commercial (3 semaines)**
`C1` attestation signée, `C4` contrôle de lisibilité, `B5` rendu imprimable.
De quoi tenir un discours que personne d'autre ne tient.

**Étape 3 — le pari (3 semaines)**
`C2` questionnaire différentiel, `B3` analyse statique.
Plus risqué, mais c'est ce qui aligne le produit sur le pKYC, modèle de référence en 2026.

**Étape 4 — confort (au fil de l'eau)**
`B2` génération de types, `B4` rejeu de session, `A2`, `A3`, `A5`, `A6`.

---

## 8. Ce que je ne recommande pas

Par honnêteté, autant dire ce qu'il ne faut **pas** faire :

**Un générateur de formulaire par IA.** En 2026, _« can it generate a form from a prompt? »_ ne
distingue plus les bons produits des autres — tous savent le faire. Ce serait beaucoup de
travail pour arriver au niveau du gratuit de Google Forms.

**Un mode conversationnel façon Typeform Formless.** L'idée est bonne (30 à 50 % de
complétion en plus), mais elle est prise, elle demande un LLM en ligne — donc des données qui
sortent — et elle contredit frontalement le principe « zéro réseau » qui fait notre valeur.

**Courir après les 30 types de questions de SurveyJS.** Course perdue à effectif comparable, et
sans effet sur ce qui nous distingue.

**Un module d'analytique de réponses.** Utile, mais c'est le métier de l'entrepôt de données du
client. Notre travail s'arrête à produire un `SurveyResult` propre et exploitable — ce qu'il
fait déjà.

---

## 9. Sources

- [SurveyJS — validation client / serveur](https://surveyjs.io/stay-updated/blog/client-server-data-validation) et
  [issue #1340, ouverte depuis 2019](https://github.com/surveyjs/survey-library/issues/1340)
- [Perpetual KYC — American Bankers Association](https://www.aba.com/news-research/analysis-guides/perpetual-kyc)
- [Les banques face au pKYC devenu standard, mai 2026](https://fintech.global/2026/05/15/banks-face-rising-risk-as-perpetual-kyc-becomes-standard/)
- [European Accessibility Act — guide de conformité 2026](https://www.levelaccess.com/compliance-overview/european-accessibility-act-eaa/)
- [EAA et accessibilité de la banque en ligne](https://accessible.org/online-banking-accessibilityeaa/)
- [État des générateurs de formulaires par IA en 2026](https://www.fillout.com/blog/best-ai-form-builder)
- [Comparatif JSON Schema Forms — RJSF, JSON Forms, SurveyJS, Form.io](https://form.io/json-schema-forms-formio-rjsf-jsonforms-surveyjs-compared/)
