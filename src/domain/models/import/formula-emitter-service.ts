/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ONE formula emitter: a shared-AST node in, Sovrium formula text out.
 *
 * Each node kind has one rule. A call is looked up in its dialect's function
 * table and emitted through the row: a rename, a special emitter, or a
 * refusal carrying the row's outcome and reason. A field reference becomes
 * the Sovrium name of the field it points at, and carries that field's type,
 * which is what the operators check their operands against.
 *
 * The first refusal ends the emission. The result is either the text, its
 * type and the notes its functions carried, or the outcome and the reason the
 * formula keeps its last values instead.
 */

import { binary, minus, negation } from './formula-emit-operators-service'
import {
  FormulaRefusal,
  PRECEDENCE,
  atom,
  composed,
  concatAll,
  describeType,
  notesOf,
  refuse,
  sqlNumber,
  sqlString,
  typedAll,
  withNotes,
  type EmitContext,
  type Emitted,
  type FormulaFieldMap,
} from './formula-emit-primitives-service'
import {
  lookupFormulaFunction,
  type FormulaValueType,
  type FunctionEmit,
} from './formula-function-mappings'
import { SPECIAL_EMITTERS } from './formula-special-emitters-service'
import type { FormulaDialect, FormulaNode } from './formula-ast'

/** The types a formula field can hold. */
export type FormulaResultType = Exclude<FormulaValueType, 'null' | 'unknown'>

const isResultType = (type: FormulaValueType): type is FormulaResultType =>
  type !== 'null' && type !== 'unknown'

/** What emitting one formula produced. */
export type FormulaEmission =
  | {
      readonly ok: true
      readonly formula: string
      readonly type: FormulaResultType
      readonly notes: readonly string[]
    }
  | { readonly ok: false; readonly outcome: 'degraded' | 'unsupported'; readonly reason: string }

const field = (ref: string, context: EmitContext): Emitted => {
  const target = context.fields.get(ref)
  return target === undefined
    ? refuse('unsupported', `The formula references a field the import does not carry: "${ref}"`)
    : atom(target.name, target.type)
}

/** A rename row: the same call under a whitelisted name, its arguments type-checked. */
const renamed = (
  name: string,
  emit: Extract<FunctionEmit, { readonly kind: 'rename' }>,
  args: readonly FormulaNode[],
  context: EmitContext
): Emitted => {
  const pieces = typedAll(`${name}()`, emit.accepts, args.map(context.emit))
  const type = emit.returns === 'first' ? (pieces[0]?.type ?? 'null') : emit.returns
  return composed(
    `${emit.name}(${pieces.map((piece) => piece.sql).join(', ')})`,
    type,
    PRECEDENCE.atom,
    pieces
  )
}

const call = (name: string, args: readonly FormulaNode[], context: EmitContext): Emitted => {
  const row = lookupFormulaFunction(context.dialect, name)
  if (row.outcome !== 'mapped') return refuse(row.outcome, `${name}(): ${row.reason}`)
  const [fewest, most] = row.arity
  if (args.length < fewest || args.length > most) {
    return refuse('unsupported', `${name}() is called with ${args.length} arguments`)
  }
  const emitted =
    row.emit.kind === 'special'
      ? SPECIAL_EMITTERS[row.emit.name](args, context)
      : renamed(name, row.emit, args, context)
  return withNotes(emitted, row.note === undefined ? [] : [row.note])
}

/** The operands of a chain of `&`, left to right. */
const concatChain = (node: FormulaNode): readonly FormulaNode[] =>
  node.kind === 'binary' && node.operator === '&'
    ? [...concatChain(node.left), ...concatChain(node.right)]
    : [node]

type NodeOf<K extends FormulaNode['kind']> = Extract<FormulaNode, { readonly kind: K }>

type NodeEmitters = {
  readonly [K in FormulaNode['kind']]: (node: NodeOf<K>, context: EmitContext) => Emitted
}

const unary = (node: NodeOf<'unary'>, context: EmitContext): Emitted => {
  const operand = context.emit(node.operand)
  if (node.operator === 'not') return negation(operand)
  return node.operator === '-' ? minus(operand) : operand
}

const NODE_EMITTERS: NodeEmitters = {
  number: (node) => sqlNumber(node.value),
  string: (node) => sqlString(node.value),
  boolean: (node) => atom(node.value ? 'TRUE' : 'FALSE', 'boolean'),
  field: (node, context) => field(node.ref, context),
  identifier: (node) =>
    refuse('unsupported', `The formula uses a name it never defines: "${node.name}"`),
  list: () =>
    refuse('unsupported', 'Formulas over lists of values have no counterpart in a Sovrium formula'),
  unary,
  binary: (node, context) =>
    node.operator === '&'
      ? concatAll(concatChain(node).map(context.emit))
      : binary(node.operator, context.emit(node.left), context.emit(node.right), context.dialect),
  conditional: (node, context) =>
    SPECIAL_EMITTERS.if([node.test, node.then, node.otherwise], context),
  call: (node, context) => call(node.name, node.args, context),
}

const emitNode = (node: FormulaNode, context: EmitContext): Emitted =>
  (NODE_EMITTERS[node.kind] as (node: FormulaNode, context: EmitContext) => Emitted)(node, context)

/**
 * Emit one parsed formula as Sovrium formula text.
 *
 * Never throws. A formula whose value is always blank, or whose type cannot be
 * told, is refused too: a formula field needs a result type to be created.
 */
export const emitFormula = (
  dialect: FormulaDialect,
  node: FormulaNode,
  fields: FormulaFieldMap
): FormulaEmission => {
  const context: EmitContext = {
    dialect,
    fields,
    emit: (child) => emitNode(child, context),
  }
  try {
    const emitted = context.emit(node)
    return isResultType(emitted.type)
      ? { ok: true, formula: emitted.sql, type: emitted.type, notes: notesOf(emitted) }
      : {
          ok: false,
          outcome: 'unsupported',
          reason: `The formula's result is ${describeType(emitted.type)}`,
        }
  } catch (error) {
    if (error instanceof FormulaRefusal) {
      return { ok: false, outcome: error.outcome, reason: error.reason }
    }
    return {
      ok: false,
      outcome: 'unsupported',
      reason: `The formula could not be emitted: ${String(error)}`,
    }
  }
}
