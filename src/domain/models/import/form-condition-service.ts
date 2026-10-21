/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Form conditions as a small boolean algebra, so a jump graph can be turned
 * into per-question visibility: constants, comparisons, and/or, each negated
 * by De Morgan's laws and simplified as it is built.
 *
 * A source condition is read through its tool's comparison table
 * (`form-logic-mappings.ts`) into this algebra; the mapper then prints the
 * result as a `visibleWhen` condition. A condition that tests something the
 * form has no field for, or compares with an operator Sovrium does not have,
 * is a refusal naming why, never an approximation.
 */

import { lookupLogicOperator, oppositeOperator } from './form-logic-mappings'
import type { CanonicalCondition } from './canonical-flow'
import type { FormSourceTool } from './form-question-mappings'
import type { VisibleWhen, VisibleWhenCondition } from '@/domain/models/app/forms/visible-when'

/** A condition under construction. */
export type LogicExpr =
  | { readonly kind: 'const'; readonly value: boolean }
  | { readonly kind: 'leaf'; readonly rule: VisibleWhen }
  | { readonly kind: 'and' | 'or'; readonly items: readonly LogicExpr[] }

/** Why a condition could not be read. */
export interface LogicRefusal {
  readonly refused: string
}

export const TRUE: LogicExpr = { kind: 'const', value: true }
export const FALSE: LogicExpr = { kind: 'const', value: false }

export const isRefusal = (value: unknown): value is LogicRefusal =>
  typeof value === 'object' && value !== null && 'refused' in value

const combine = (kind: 'and' | 'or', items: readonly LogicExpr[]): LogicExpr => {
  const absorbing = kind === 'and' ? false : true
  const flat = items.flatMap((item) => (item.kind === kind ? item.items : [item]))
  if (flat.some((item) => item.kind === 'const' && item.value === absorbing)) {
    return { kind: 'const', value: absorbing }
  }
  const kept = flat.filter((item) => item.kind !== 'const')
  const unique = kept.filter(
    (item, index) =>
      kept.findIndex((other) => JSON.stringify(other) === JSON.stringify(item)) === index
  )
  if (unique.length === 0) return { kind: 'const', value: !absorbing }
  return unique.length === 1 ? (unique[0] ?? TRUE) : { kind, items: unique }
}

/** Every item holds. */
export const allOf = (items: readonly LogicExpr[]): LogicExpr => combine('and', items)

/** At least one item holds. */
export const anyOf = (items: readonly LogicExpr[]): LogicExpr => combine('or', items)

/** The opposite condition, or `undefined` when a comparison has no opposite. */
export const negate = (expr: LogicExpr): LogicExpr | undefined => {
  if (expr.kind === 'const') return { kind: 'const', value: !expr.value }
  if (expr.kind === 'leaf') {
    const opposite = oppositeOperator(expr.rule.operator)
    return opposite === undefined
      ? undefined
      : { kind: 'leaf', rule: { ...expr.rule, operator: opposite } }
  }
  const negated = expr.items.map(negate)
  if (negated.some((item) => item === undefined)) return undefined
  const items = negated.filter((item): item is LogicExpr => item !== undefined)
  return expr.kind === 'and' ? anyOf(items) : allOf(items)
}

/** The condition as `visibleWhen` prints it; a constant has no condition to print. */
export const toVisibleWhen = (expr: LogicExpr): VisibleWhenCondition | undefined => {
  if (expr.kind === 'const') return undefined
  if (expr.kind === 'leaf') return expr.rule
  const items = expr.items
    .map(toVisibleWhen)
    .filter((item): item is VisibleWhenCondition => item !== undefined)
  return expr.kind === 'and' ? { and: items } : { or: items }
}

/** The form field each tested thing is, by kind. */
export interface ConditionFields {
  readonly question: (sourceId: string) => string | undefined
  readonly hidden: (name: string) => string | undefined
  readonly variable: (name: string) => string | undefined
}

type Scalar = string | number | boolean

const isScalar = (value: unknown): value is Scalar =>
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value))

const isCondition = (value: unknown): value is CanonicalCondition =>
  typeof value === 'object' &&
  value !== null &&
  'combinator' in value &&
  Array.isArray((value as { readonly rules?: unknown }).rules)

/** The field a rule's left side names, or a refusal saying what it names. */
const fieldOf = (left: unknown, fields: ConditionFields): string | LogicRefusal => {
  const ref = (left ?? {}) as Readonly<Record<string, unknown>>
  const [kind, value] =
    (['question', 'hidden', 'variable'] as const)
      .filter((key) => typeof ref[key] === 'string')
      .map((key) => [key, String(ref[key])] as const)[0] ?? []
  const field = kind === undefined || value === undefined ? undefined : fields[kind](value)
  if (field !== undefined) return field
  return {
    refused:
      kind === 'variable'
        ? `it tests the computed variable "${value ?? ''}", which is not a field of the form`
        : `it tests ${JSON.stringify(left)}, which is not a field of the form`,
  }
}

const NOT_SCALAR: LogicRefusal = {
  refused: 'it compares with a value that is not text or a number',
}

const NO_VALUE: ReadonlySet<string> = new Set(['empty', 'notEmpty'])

const LIST_VALUE: ReadonlySet<string> = new Set(['in', 'notIn'])

/** One compared value: a scalar, or a one-item list read as its item. */
const scalarOf = (right: unknown): VisibleWhen['value'] | LogicRefusal => {
  const single = Array.isArray(right) && right.length === 1 ? right[0] : right
  return isScalar(single) ? single : NOT_SCALAR
}

/** The compared value, shaped for the operator. */
const valueFor = (
  operator: VisibleWhen['operator'],
  right: unknown
): VisibleWhen['value'] | LogicRefusal | undefined => {
  if (NO_VALUE.has(operator)) return undefined
  if (!LIST_VALUE.has(operator)) return scalarOf(right)
  const list = Array.isArray(right) ? right : [right]
  return list.every(isScalar) ? list : NOT_SCALAR
}

/** One rule of a condition. */
const readRule = (
  tool: FormSourceTool,
  rule: CanonicalCondition['rules'][number],
  fields: ConditionFields
): LogicExpr | LogicRefusal => {
  if (rule.operator === 'group' && isCondition(rule.left)) {
    return readCondition(tool, rule.left, fields)
  }
  const operator = lookupLogicOperator(tool, rule.operator)
  if (operator === undefined) {
    return { refused: `the comparison "${rule.operator}" has no Sovrium equivalent` }
  }
  if (operator === 'always') return TRUE
  const field = fieldOf(rule.left, fields)
  if (isRefusal(field)) return field
  const value = valueFor(operator, rule.right)
  if (isRefusal(value)) return value
  return { kind: 'leaf', rule: { field, operator, ...(value === undefined ? {} : { value }) } }
}

/**
 * A source condition in the algebra. An absent condition always holds.
 */
export const readCondition = (
  tool: FormSourceTool,
  condition: CanonicalCondition | undefined,
  fields: ConditionFields
): LogicExpr | LogicRefusal => {
  if (condition === undefined) return TRUE
  const items = condition.rules.map((rule) => readRule(tool, rule, fields))
  const refused = items.find(isRefusal)
  if (refused !== undefined) return refused
  const read = items.filter((item): item is LogicExpr => !isRefusal(item))
  return condition.combinator === 'and' ? allOf(read) : anyOf(read)
}
