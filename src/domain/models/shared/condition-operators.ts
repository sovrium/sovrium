/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const ConditionValueSchema = Schema.Union(Schema.String, Schema.Number, Schema.Boolean)

const ConditionValueArraySchema = Schema.Array(ConditionValueSchema)

export const ConditionOperatorsSchema = Schema.Struct({
  eq: Schema.optional(ConditionValueSchema),
  neq: Schema.optional(ConditionValueSchema),
  in: Schema.optional(ConditionValueArraySchema),
  notIn: Schema.optional(ConditionValueArraySchema),
  contains: Schema.optional(ConditionValueSchema),
  gt: Schema.optional(ConditionValueSchema),
  lt: Schema.optional(ConditionValueSchema),
  gte: Schema.optional(ConditionValueSchema),
  lte: Schema.optional(ConditionValueSchema),
}).annotations({
  title: 'Condition Operators',
  description:
    'Condition matcher: { operator: value }. Supports eq, neq, in, notIn, contains, gt, lt, gte, lte.',
})

export type ConditionOperators = Schema.Schema.Type<typeof ConditionOperatorsSchema>

export const FieldConditionSchema = Schema.Struct({
  field: Schema.String.annotations({
    description: 'Record field whose value the visibility predicate is matched against',
  }),
  ...ConditionOperatorsSchema.fields,
}).annotations({
  title: 'Field Condition',
  description:
    'Per-record predicate: the target renders only on records whose `field` value satisfies the operator(s). Reuses the shared condition vocabulary (eq, neq, in, notIn, contains, gt, lt, gte, lte). Omit to show on every record.',
})

export type FieldCondition = Schema.Schema.Type<typeof FieldConditionSchema>

const matchesCondition = (
  operator: string,
  expected: unknown,
  strValue: string,
  numValue: number
): boolean => {
  const matchers: Record<string, () => boolean> = {
    eq: () => strValue === String(expected),
    neq: () => strValue !== String(expected),
    in: () => Array.isArray(expected) && expected.some((entry) => String(entry) === strValue),
    notIn: () => Array.isArray(expected) && !expected.some((entry) => String(entry) === strValue),
    contains: () => strValue.includes(String(expected)),
    gt: () => !Number.isNaN(numValue) && numValue > Number(expected),
    lt: () => !Number.isNaN(numValue) && numValue < Number(expected),
    gte: () => !Number.isNaN(numValue) && numValue >= Number(expected),
    lte: () => !Number.isNaN(numValue) && numValue <= Number(expected),
  }
  return matchers[operator]?.() ?? false
}

export const matchesConditionOperators = (
  operators: Readonly<Record<string, unknown>>,
  value: unknown
): boolean => {
  const strValue = String(value)
  const numValue = Number(value)
  return Object.entries(operators)
    .filter(([, expected]) => expected !== undefined)
    .every(([operator, expected]) => matchesCondition(operator, expected, strValue, numValue))
}

export const satisfiesFieldCondition = (
  condition: Readonly<FieldCondition> | undefined,
  record: Readonly<Record<string, unknown>>
): boolean => {
  if (!condition) return true
  const { field, ...operators } = condition
  return matchesConditionOperators(operators, record[field])
}
