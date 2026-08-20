# Analyse du projet et pistes d'évolution

> Août 2026. Trois choses : un état des lieux factuel, un positionnement face au marché, et
> des idées **classées par degré réel de nouveauté** — annoncer comme innovant ce que tout le
> monde fait déjà est le meilleur moyen de perdre la confiance d'une équipe.
>
> Le package est ici considéré comme une **solution générique**, utilisable dans n'importe
> quel projet. Le cahier des charges bancaire qui l'a fait naître n'est plus qu'un cas d'usage
> parmi d'autres.

---

## 1. État des lieux

| Brique                               | Volume       | Maturité                                       |
| ------------------------------------ | ------------ | ---------------------------------------------- |
| `core` — modèle, expressions, moteur | 5 221 lignes | solide, 91–98 % de couverture                  |
| `builder` — concepteur               | 3 046 lignes | fonctionnel, glisser-déposer souris et clavier |
| `runtime` — rendu React              | 1 703 lignes | solide, WCAG 2.1 AA vérifié par axe-core       |
| `headless` — pilotage sans framework | 237 lignes   | livré                                          |
| `element` — Web Component            | 320 lignes   | livré, 41 Ko gzip autonome                     |
| `styles`                             | 1 962 lignes | 5 thèmes, 83 variables CSS                     |
| tests                                | 624 tests    | bon sur `core`, plus léger sur l'UI du builder |

### Ce qui fait la valeur — et ce n'est pas « un builder de plus »

**a) Le moteur est du TypeScript pur.** `core` n'importe React zéro fois. Vérifié en CI par un
test qui l'importe en CJS _et_ en ESM depuis Node. C'est ce qui a permis, en une semaine,
d'ajouter un mode headless et un Web Component sans réécrire un seul champ.

**b) Les expressions sont un AST, pas des chaînes.** On sait déjà répondre à « de quoi dépend
cette règle ? » (`collectReferences`) et « quelles fonctions appelle-t-elle ? »
(`collectFunctionCalls`). Toute une classe d'analyses statiques est à portée, et personne ne
l'exploite dans ce domaine.

**c) Aucun appel réseau, aucune ressource externe.** Les données ne quittent jamais
l'application hôte. C'est ce qui rend le package utilisable là où un SaaS est disqualifié —
santé, finance, secteur public, ou simplement une équipe qui refuse d'exfiltrer ses formulaires.

**d) L'accessibilité est vérifiée par la machine**, pas déclarée. axe-core casse la CI.

### Les angles morts, sans complaisance

| Manque                        | Gravité    | Pourquoi c'est gênant                                                                                     |
| ----------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| Pas de re-validation serveur  | **élevée** | Un client peut forger une requête et contourner toute obligation. Le backend n'a aucun moyen de vérifier. |
| Types de questions limités    | moyenne    | Ni matrice, ni panel répétable, ni upload, ni signature.                                                  |
| Couverture de l'UI du builder | moyenne    | `builder/layout` à 40 %.                                                                                  |
| `.d.ts` de 284 Ko             | faible     | L'inférence Zod s'inline et ralentit le `tsc` des consommateurs.                                          |
| Pas de rendu imprimable       | moyenne    | Aucun moyen d'archiver un questionnaire rempli.                                                           |
| RTL jamais testé              | faible     | Les propriétés logiques CSS sont là, mais rien ne le vérifie.                                             |

---

## 2. Où l'on se situe

|                             | SurveyJS                | Form.io         | Typeform     | **Ce projet**                  |
| --------------------------- | ----------------------- | --------------- | ------------ | ------------------------------ |
| Builder                     | payant, par développeur | open source     | SaaS         | **inclus, MIT**                |
| Données hébergées           | chez vous               | chez vous       | **chez eux** | chez vous                      |
| Frameworks                  | paquets séparés         | Angular d'abord | s.o.         | **un Web Component pour tous** |
| Mode headless               | non                     | non             | non          | **oui**                        |
| Moteur réutilisable serveur | non                     | partiel         | non          | **oui**                        |
| A11y vérifiée en CI         | non documenté           | non             | non          | **oui**                        |
| Types de questions          | ~30                     | ~30             | ~25          | **11**                         |
| Poids du rendu              | ~150 Ko + framework     | lourd           | s.o.         | **41 Ko autonome**             |

Lecture honnête : **devant sur l'architecture, la licence et le poids ; derrière sur la
richesse fonctionnelle.** La stratégie qui en découle n'est pas de courir après les 30 types
de questions de SurveyJS — course perdue à effectif comparable — mais d'aller là où
l'architecture donne un avantage que les autres ne peuvent pas copier sans se réécrire.

---

## 3. Famille A — Le rattrapage

Rien d'innovant. Des attentes de base, dont l'absence se remarque en démonstration.

| #   | Sujet                              | Effort | Note                                                                                            |
| --- | ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| A1  | Panel dynamique (groupe répétable) | ~3 j   | Le plus demandé. « Ajoutez chaque enfant, chaque véhicule, chaque poste. »                      |
| A2  | Matrice simple et dynamique        | ~4 j   | Vient juste après.                                                                              |
| A3  | Upload de fichier                  | ~2 j   | Le composant seulement ; le stockage reste à l'hôte, cohérent avec le principe « zéro réseau ». |
| A4  | Signature manuscrite               | ~2 j   | Canvas → image.                                                                                 |
| A5  | Curseur, classement                | ~2 j   | Peu coûteux, complète le set.                                                                   |
| A6  | Éditeur de thème dans le builder   | ~3 j   | Les jetons existent ; il ne manque que l'interface.                                             |

---

## 4. Famille B — La différenciation

Ce que peu font, et que notre architecture rend faciles alors que c'est coûteux ailleurs.

### B1 — Re-validation serveur avec le même moteur ⭐

**Le manque le plus grave, et un angle mort du marché entier.**

Le backend reçoit un `SurveyResult` sans aucun moyen de vérifier sa cohérence. Un client peut
omettre une question obligatoire, répondre à une question qui aurait dû rester masquée,
envoyer une valeur hors bornes, ou inventer un nom de question.

SurveyJS documente explicitement que ce n'est pas son problème ; la demande y est ouverte
depuis 2019 ([issue #1340](https://github.com/surveyjs/survey-library/issues/1340)).

Nous avons déjà tout : le moteur tourne dans Node.

```ts
import { verifySubmission } from '@dahhouilyas/survey/core';

const verdict = verifySubmission(definition, payload.answers);
if (!verdict.valid) return res.status(422).json(verdict.violations);
// [ { kind: 'answered-hidden-question', questionName: 'employeur' },
//   { kind: 'missing-required',         questionName: 'email' } ]
```

**Effort : ~4 jours.** Ce n'est pas une question de secteur : tout projet qui reçoit un
formulaire en a besoin.

### B2 — Génération de types depuis une définition ⭐

Il existe des générateurs de types pour GraphQL, Supabase, Sanity. **Aucun pour une définition
de formulaire.**

```bash
npx survey-codegen formulaire.json > formulaire.types.ts
```

```ts
export interface Answers {
  email: string;
  situation: 'salarie' | 'independant' | 'retraite';
  employeur?: string; // conditionnelle → optionnelle
}
```

Le backend devient typé contre le questionnaire : renommez une question, régénérez, et le
compilateur signale chaque endroit à corriger. **Effort : ~3 jours** — l'information est déjà
dans le modèle.

### B3 — Analyse statique du questionnaire ⭐

Un questionnaire est un programme ; personne ne le traite comme tel.

| Diagnostic               | Question posée                                                    |
| ------------------------ | ----------------------------------------------------------------- |
| Question inatteignable   | Existe-t-il un chemin de réponses menant à son affichage ?        |
| Condition contradictoire | `{age} > 60 and {age} < 30` — jamais vraie.                       |
| Obligation impossible    | Obligatoire, mais jamais affichable.                              |
| Complexité               | « 47 chemins distincts, profondeur 6 » — un signal de conception. |

**Effort : ~5 jours** pour les cas décidables simplement.

### B4 — Rejeu de session

Le moteur émet déjà des événements. Les enregistrer donne un journal rejouable : le support
voit ce que l'utilisateur a fait, un bug se reproduit dans un test, l'auteur voit où les gens
abandonnent. **Effort : ~3 jours.**

### B5 — Rendu imprimable

Mode `print` — questions et réponses, sans interactif — plus une feuille `@media print`.
**Effort : ~2 jours.**

---

## 5. Famille C — Ce que je n'ai trouvé nulle part

Quatre idées sans implémentation existante identifiée. Point commun : elles ne sont possibles
que parce que le moteur est pur, que les expressions sont un AST et que rien ne sort de
l'application.

### C1 — Diff sémantique entre deux versions 🔷

**Le problème.** Vous modifiez un questionnaire déjà en production. Que casse-t-il pour les
réponses déjà collectées ? Aujourd'hui : personne n'en sait rien avant de regarder les données.

Le versionnage de formulaire existe (Orbeon, FormAssembly, TeamForms) mais il ne répond qu'à
« quelle version s'applique à quelle réponse ». **Aucun outil ne dit ce qu'un changement
casse.**

```
$ survey-diff v1.json v2.json --responses ./export.json

🔴 CASSANT   question 'email' renommée en 'courriel'
             → 1 240 réponses deviendront orphelines
🔴 CASSANT   'age' : type number → text
             → 1 240 valeurs ne correspondront plus au type attendu
🟡 ATTENTION 'pays' : option 'FR' supprimée
             → 312 réponses portent cette valeur
🟡 ATTENTION 'telephone' devient obligatoire
             → 890 réponses existantes ne la renseignent pas
🟢 SÛR       nouvelle question facultative 'commentaire'
```

**Pourquoi personne ne le fait :** il faut comparer deux définitions **sémantiquement** — pas
un `diff` textuel — en comprenant ce que chaque changement implique pour des données. Cela
suppose un modèle structuré et un moteur qui sait déjà résoudre visibilité et obligation.
Nous avons les deux. **Effort : ~5 jours.**

### C2 — Preuve d'affichage 🔷

**Le problème.** Un utilisateur conteste : « on ne m'a jamais posé cette question », ou « la
formulation n'était pas celle-là ». Que produisez-vous ? Des réponses en base, sans aucune
trace du libellé exact affiché, de la langue, ni de la version.

Cela vaut pour un consentement RGPD, des conditions générales, un questionnaire médical, une
inscription à un concours — partout où le formulaire est un **acte**, pas un sondage.

```jsonc
{
  "definitionHash": "sha256:9f2c…", // empreinte de la définition EXACTE affichée
  "locale": "fr",
  "renderedQuestions": [
    {
      "name": "consentement",
      "title": "J'accepte le traitement de mes données",
      "titleHash": "sha256:4a1e…",
      "shownAt": "2026-08-20T09:12:03Z",
    },
  ],
  "answers": [/* … */],
}
```

**Pourquoi personne ne le fait :** un SaaS ne le peut pas — la définition vit chez lui et
change sans trace côté client. Une bibliothèque d'UI ne s'estime pas concernée. Il faut un
moteur qui connaisse à la fois la définition, le rendu et le résultat. **Effort : ~4 jours.**

### C3 — Provenance de chaque réponse 🔷

Ces trois situations sont stockées aujourd'hui de façon identique :

1. l'utilisateur a saisi la réponse ;
2. elle était pré-remplie et il l'a confirmée sans y toucher ;
3. elle était pré-remplie et il l'a **modifiée**.

Le troisième cas est un signal fort : l'utilisateur contredit votre donnée. Aucune
bibliothèque de formulaire ne le distingue.

```ts
{ questionName: 'email', value: 'a@b.fr',
  provenance: 'prefilled-modified',   // 'user' | 'prefilled-confirmed' | 'prefilled-modified'
  prefilledValue: 'ancien@b.fr' }
```

**Effort : ~3 jours.** Une variante mesurant les hésitations (nombre de changements, temps
passé) est possible mais **intrusive** : à laisser désactivée par défaut et à soumettre à une
analyse d'impact avant tout usage.

### C4 — Contrôle de lisibilité et de charge cognitive 🔷

Les formulaires sont écrits par des juristes, des médecins ou des ingénieurs — rarement par
des gens dont le métier est d'être compris. L'accessibilité **technique** est vérifiée chez
nous ; l'accessibilité **cognitive** ne l'est nulle part.

```
⚠ « consentement » — phrase de 34 mots, lisibilité 28/100 (très difficile)
⚠ « revenus » — 3 termes de jargon : « assiette », « quotient », « abattement »
⚠ Page 2 — 14 questions obligatoires d'affilée ; au-delà de 7, l'abandon grimpe
✓ Contraste du thème : 7,1:1 — conforme AA et AAA
```

Tout est calculable **hors ligne**, sans IA : indice de lisibilité, lexique de jargon,
comptage de charge, contraste dérivé des jetons CSS.

**Pourquoi personne ne le fait :** les builders traitent le texte comme une chaîne opaque.
Aucun ne considère la _rédaction_ comme un objet à valider. **Effort : ~4 jours.**

---

## 6. Le fil rouge

Les idées de la famille C disent toutes la même chose :

> **Un formulaire n'est pas un écran. C'est un engagement, qui doit être prouvable,
> vérifiable, versionnable et compréhensible.**

| Idée                        | Propriété visée    |
| --------------------------- | ------------------ |
| C2 — preuve d'affichage     | **prouvable**      |
| B1 — re-validation serveur  | **vérifiable**     |
| C1 — diff sémantique        | **versionnable**   |
| C4 — contrôle de lisibilité | **compréhensible** |

Aucun concurrent ne peut suivre sur ces quatre axes sans refaire son architecture : il faut un
moteur pur, exécutable des deux côtés, avec des règles inspectables et zéro dépendance réseau.

C'est ça, le positionnement défendable — pas « un builder de plus, mais gratuit ».

---

## 7. Séquencement proposé

**Étape 1 — combler le trou (2 semaines)** — `B1`, `A1`, `A4`.
Sans B1, aucune équipe sérieuse ne peut défendre le module devant un audit.

**Étape 2 — l'argument (3 semaines)** — `C1`, `C4`, `B5`.
De quoi tenir un discours que personne d'autre ne tient.

**Étape 3 — le pari (2 semaines)** — `C2`, `B3`.

**Étape 4 — confort** — `B2`, `B4`, `A2`, `A3`, `A5`, `A6`.

---

## 8. Ce que je ne recommande pas

**Un générateur de formulaire par IA.** En 2026, _« can it generate a form from a prompt? »_ ne
distingue plus les bons produits des autres — Google Forms le fait gratuitement.

**Un mode conversationnel façon Typeform.** L'idée marche (30 à 50 % de complétion en plus),
mais elle est prise, elle demande un LLM en ligne — donc des données qui sortent — et elle
contredit le principe « zéro réseau » qui fait notre valeur.

**Courir après les 30 types de questions de SurveyJS.** Course perdue, et sans effet sur ce
qui nous distingue.

**Un module d'analytique.** C'est le métier de l'entrepôt de données du client. Notre travail
s'arrête à produire un `SurveyResult` propre — ce qu'il fait déjà.

---

## 9. Sources

- [SurveyJS — validation client / serveur](https://surveyjs.io/stay-updated/blog/client-server-data-validation)
  et [issue #1340, ouverte depuis 2019](https://github.com/surveyjs/survey-library/issues/1340)
- [Versionnage de formulaire — Orbeon Forms](https://doc.orbeon.com/form-runner/features/versioning)
- [Impact d'une mise à jour sur les réponses existantes — Team Forms](https://help.teamforms.app/en/articles/9126341-what-happens-to-existing-responses-if-i-publish-an-update-to-my-form-template)
- [État des générateurs de formulaires par IA en 2026](https://www.fillout.com/blog/best-ai-form-builder)
- [Comparatif JSON Schema Forms — RJSF, JSON Forms, SurveyJS, Form.io](https://form.io/json-schema-forms-formio-rjsf-jsonforms-surveyjs-compared/)
- [AgnosUI — composants multi-frameworks à cœur agnostique](https://github.com/AmadeusITGroup/AgnosUI)
