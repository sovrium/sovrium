/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one formula AST every source dialect is parsed into.
 *
 * Airtable and Notion spell the same ideas differently (`{Field}` against
 * `prop("Field")`, `&` against `+` on text, `IF()` against `? :`). Each dialect
 * has its own lexer rules and operator table, and both produce these nodes, so
 * ONE emitter turns either into Sovrium formula text.
 *
 * - A function name is kept in the source's own spelling, upper-cased, so the
 *   dialect's function table is the only place that decides what it becomes.
 * - Operators are normalised to one vocabulary: Airtable `&` and Notion `+`
 *   on text both stay as written (`&`, `+`), because only the emitter knows
 *   the operand types and so whether `+` adds or concatenates.
 * - A Notion method call (`x.lower()`) is the call `LOWER(x)`; the parser
 *   rewrites it, so the AST has one call shape.
 */

/** The dialects with a formula parser. */
export type FormulaDialect = 'airtable' | 'notion'

/** A binary operator, in the shared vocabulary. */
export type FormulaBinaryOperator =
  '+' | '-' | '*' | '/' | '%' | '^' | '&' | '=' | '!=' | '<' | '<=' | '>' | '>=' | 'and' | 'or'

/** A unary operator. */
export type FormulaUnaryOperator = '-' | '+' | 'not'

/** One node of a parsed formula. */
export type FormulaNode =
  | { readonly kind: 'number'; readonly value: number; readonly text: string }
  | { readonly kind: 'string'; readonly value: string }
  | { readonly kind: 'boolean'; readonly value: boolean }
  /** A reference to a field, by the key the source used: an id or a name. */
  | { readonly kind: 'field'; readonly ref: string }
  /** A name bound by Notion's `let`/`lets`, or a bare identifier. */
  | { readonly kind: 'identifier'; readonly name: string }
  | {
      readonly kind: 'binary'
      readonly operator: FormulaBinaryOperator
      readonly left: FormulaNode
      readonly right: FormulaNode
    }
  | {
      readonly kind: 'unary'
      readonly operator: FormulaUnaryOperator
      readonly operand: FormulaNode
    }
  | {
      readonly kind: 'conditional'
      readonly test: FormulaNode
      readonly then: FormulaNode
      readonly otherwise: FormulaNode
    }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly FormulaNode[] }
  | { readonly kind: 'list'; readonly items: readonly FormulaNode[] }

/** A parse that failed, with the position the parser stopped at. */
export interface FormulaParseError {
  readonly ok: false
  readonly reason: string
}

/** The result of parsing one formula. */
export type FormulaParse = { readonly ok: true; readonly node: FormulaNode } | FormulaParseError

/**
 * The same node with `transform` applied to each direct child.
 *
 * The one place that knows which node kinds have children, so a rewrite
 * (substituting `let` names, folding) states only the case it changes.
 */
export const mapFormulaChildren = (
  node: FormulaNode,
  transform: (child: FormulaNode) => FormulaNode
): FormulaNode => {
  if (node.kind === 'binary') {
    return { ...node, left: transform(node.left), right: transform(node.right) }
  }
  if (node.kind === 'unary') return { ...node, operand: transform(node.operand) }
  if (node.kind === 'conditional') {
    return {
      ...node,
      test: transform(node.test),
      then: transform(node.then),
      otherwise: transform(node.otherwise),
    }
  }
  if (node.kind === 'call') return { ...node, args: node.args.map(transform) }
  if (node.kind === 'list') return { ...node, items: node.items.map(transform) }
  return node
}
