export type BinaryOperator =
  | 'or'
  | 'and'
  | '=='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | 'contains'
  | 'notcontains'
  | 'anyof'
  | 'allof'
  | 'noneof'
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^';

export type UnaryOperator = '!' | '-';
export type PostfixOperator = 'empty' | 'notempty';

export interface LiteralNode {
  kind: 'literal';
  value: string | number | boolean | null;
}

/** Référence à une réponse : `{montant}`, `{coordonnees.ville}`, `{item}`. */
export interface RefNode {
  kind: 'ref';
  /** Chemin éclaté : `{a.b[0]}` → `['a', 'b', '0']`. */
  path: string[];
  /** Texte d'origine, conservé pour les messages et le graphe de dépendances. */
  source: string;
}

export interface ArrayNode {
  kind: 'array';
  items: ExpressionNode[];
}

export interface UnaryNode {
  kind: 'unary';
  operator: UnaryOperator;
  operand: ExpressionNode;
}

export interface PostfixNode {
  kind: 'postfix';
  operator: PostfixOperator;
  operand: ExpressionNode;
}

export interface BinaryNode {
  kind: 'binary';
  operator: BinaryOperator;
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface CallNode {
  kind: 'call';
  name: string;
  args: ExpressionNode[];
}

export type ExpressionNode =
  LiteralNode | RefNode | ArrayNode | UnaryNode | PostfixNode | BinaryNode | CallNode;

/**
 * Noms de premier niveau référencés par l'expression.
 * Alimente le graphe de dépendances du moteur : un changement de valeur ne
 * réévalue que les expressions qui en dépendent réellement.
 */
export function collectReferences(node: ExpressionNode, into = new Set<string>()): Set<string> {
  switch (node.kind) {
    case 'ref': {
      const root = node.path[0];
      if (root !== undefined) into.add(root);
      break;
    }
    case 'array':
      for (const item of node.items) collectReferences(item, into);
      break;
    case 'unary':
    case 'postfix':
      collectReferences(node.operand, into);
      break;
    case 'binary':
      collectReferences(node.left, into);
      collectReferences(node.right, into);
      break;
    case 'call':
      for (const argument of node.args) collectReferences(argument, into);
      break;
    case 'literal':
      break;
  }
  return into;
}

/** Noms de fonctions appelées — sert à signaler une fonction inconnue à l'auteur. */
export function collectFunctionCalls(node: ExpressionNode, into = new Set<string>()): Set<string> {
  switch (node.kind) {
    case 'call':
      into.add(node.name);
      for (const argument of node.args) collectFunctionCalls(argument, into);
      break;
    case 'array':
      for (const item of node.items) collectFunctionCalls(item, into);
      break;
    case 'unary':
    case 'postfix':
      collectFunctionCalls(node.operand, into);
      break;
    case 'binary':
      collectFunctionCalls(node.left, into);
      collectFunctionCalls(node.right, into);
      break;
    case 'ref':
    case 'literal':
      break;
  }
  return into;
}
