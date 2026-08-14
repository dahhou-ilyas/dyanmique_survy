/**
 * `@edb/survey` — point d'entrée par défaut : modèle + moteur de rendu.
 *
 * Le builder n'est **pas** ré-exporté ici : il pèse plusieurs dizaines de kilo-octets
 * (drag & drop, éditeurs de propriétés) et n'a rien à faire dans le bundle d'une
 * application qui se contente d'afficher des sondages. Il s'importe explicitement :
 *
 *   import { SurveyBuilder } from '@edb/survey/builder';
 */

export * from './core/index';
export * from './runtime/index';
