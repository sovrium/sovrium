/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { VisibleWhen, VisibleWhenCondition } from './visible-when'

export type FieldValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<string | number | boolean>

const isAbsent = (value: FieldValue): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

const toComparableNumber = (value: FieldValue): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value !== '') {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
    const dateNum = Date.parse(value)
    if (Number.isFinite(dateNum)) return dateNum
  }
  return undefined
}

const toScalarString = (value: FieldValue): string => {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map((v) => String(v)).join(',')
  return String(value)
}

const evaluateContains = (fieldValue: FieldValue, expected: VisibleWhen['value']): boolean => {
  if (expected === undefined) return false
  if (Array.isArray(fieldValue)) {
    return fieldValue.some((entry) => String(entry) === String(expected))
  }
  if (typeof fieldValue === 'string') {
    return fieldValue.includes(String(expected))
  }
  return false
}

const evaluateMembership = (
  fieldValue: FieldValue,
  expected: VisibleWhen['value'],
  positive: boolean
): boolean => {
  if (!Array.isArray(expected)) return !positive
  const fieldString = toScalarString(fieldValue)
  const matched = expected.some((entry) => String(entry) === fieldString)
  return positive ? matched : !matched
}

const evaluateOrdered = (
  fieldValue: FieldValue,
  expected: VisibleWhen['value'],
  compare: (a: number, b: number) => boolean
): boolean => {
  const left = toComparableNumber(fieldValue)
  if (left === undefined) return false
  const right =
    Array.isArray(expected) || expected === undefined
      ? undefined
      : toComparableNumber(expected as FieldValue)
  if (right === undefined) return false
  return compare(left, right)
}

type OperatorEvaluator = (fieldValue: FieldValue, expected: VisibleWhen['value']) => boolean

const SIMPLE_OPERATORS: Readonly<Record<string, OperatorEvaluator>> = {
  eq: (fieldValue, expected) =>
    toScalarString(fieldValue) === toScalarString(expected as FieldValue),
  neq: (fieldValue, expected) =>
    toScalarString(fieldValue) !== toScalarString(expected as FieldValue),
  contains: (fieldValue, expected) => evaluateContains(fieldValue, expected),
  empty: (fieldValue) => isAbsent(fieldValue),
  notEmpty: (fieldValue) => !isAbsent(fieldValue),
  gt: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a > b),
  gte: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a >= b),
  lt: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a < b),
  lte: (fieldValue, expected) => evaluateOrdered(fieldValue, expected, (a, b) => a <= b),
  in: (fieldValue, expected) => evaluateMembership(fieldValue, expected, true),
  notIn: (fieldValue, expected) => evaluateMembership(fieldValue, expected, false),
}

const evaluateSimple = (
  rule: VisibleWhen,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  const evaluator = SIMPLE_OPERATORS[rule.operator]
  if (evaluator === undefined) return false
  return evaluator(values[rule.field], rule.value)
}

export const evaluateVisibleWhen = (
  condition: Readonly<VisibleWhenCondition>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if ('or' in condition) return condition.or.some((c) => evaluateVisibleWhen(c, values))
  if ('and' in condition) return condition.and.every((c) => evaluateVisibleWhen(c, values))
  return evaluateSimple(condition, values)
}
