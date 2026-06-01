/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { API_TO_UI_OPERATOR } from './operator-vocabulary'


export interface FilterOperator {
  readonly value: string
  readonly label: string
}

type OperatorCategory = 'text' | 'number' | 'date' | 'select'

const TEXT_OPERATORS: readonly FilterOperator[] = [
  { value: 'is', label: 'is' },
  { value: 'is not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'does not contain', label: 'does not contain' },
  { value: 'starts with', label: 'starts with' },
  { value: 'ends with', label: 'ends with' },
]

const NUMBER_OPERATORS: readonly FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not equals', label: 'not equals' },
  { value: 'greater than', label: 'greater than' },
  { value: 'less than', label: 'less than' },
  { value: 'greater than or equal', label: 'greater than or equal' },
  { value: 'less than or equal', label: 'less than or equal' },
  { value: 'between', label: 'between' },
]

const DATE_OPERATORS: readonly FilterOperator[] = [
  { value: 'is', label: 'is' },
  { value: 'is not', label: 'is not' },
  { value: 'is before', label: 'is before' },
  { value: 'is after', label: 'is after' },
  { value: 'between', label: 'between' },
]

const SELECT_OPERATORS: readonly FilterOperator[] = [
  { value: 'is', label: 'is' },
  { value: 'is not', label: 'is not' },
  { value: 'is any of', label: 'is any of' },
  { value: 'is none of', label: 'is none of' },
]

function categorize(fieldType: string | undefined): OperatorCategory {
  if (!fieldType) return 'text'
  if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percent') return 'number'
  if (fieldType === 'date' || fieldType === 'datetime' || fieldType === 'time') return 'date'
  if (
    fieldType === 'single-select' ||
    fieldType === 'multi-select' ||
    fieldType === 'status' ||
    fieldType === 'boolean' ||
    fieldType === 'checkbox'
  ) {
    return 'select'
  }
  return 'text'
}

export function getOperatorsForType(fieldType: string | undefined): readonly FilterOperator[] {
  const category = categorize(fieldType)
  if (category === 'number') return NUMBER_OPERATORS
  if (category === 'date') return DATE_OPERATORS
  if (category === 'select') return SELECT_OPERATORS
  return TEXT_OPERATORS
}

export function isSelectValueField(fieldType: string | undefined): boolean {
  return categorize(fieldType) === 'select'
}

export function evaluatePredicate(rowValue: unknown, operator: string, value: string): boolean {
  const op = normalizeSingleValueOperator(operator)
  if (
    op === 'equals' ||
    op === 'not equals' ||
    op === 'greater than' ||
    op === 'less than' ||
    op === 'greater than or equal' ||
    op === 'less than or equal'
  ) {
    const rowNum = Number(rowValue)
    const targetNum = Number(value)
    if (Number.isNaN(rowNum) || Number.isNaN(targetNum)) return false
    if (op === 'equals') return rowNum === targetNum
    if (op === 'not equals') return rowNum !== targetNum
    if (op === 'greater than') return rowNum > targetNum
    if (op === 'less than') return rowNum < targetNum
    if (op === 'greater than or equal') return rowNum >= targetNum
    return rowNum <= targetNum
  }
  const rowStr = String(rowValue ?? '').toLowerCase()
  const valStr = value.toLowerCase()
  if (op === 'is') return rowStr === valStr
  if (op === 'is not') return rowStr !== valStr
  if (op === 'contains') return rowStr.includes(valStr)
  if (op === 'does not contain') return !rowStr.includes(valStr)
  if (op === 'starts with') return rowStr.startsWith(valStr)
  if (op === 'ends with') return rowStr.endsWith(valStr)
  if (op === 'is before') return rowStr < valStr
  if (op === 'is after') return rowStr > valStr
  const multiKind = classifyMultiValueOperator(op)
  if (multiKind !== undefined) {
    return evaluateMultiValuePredicate(rowStr, multiKind, valStr)
  }
  return false
}

function normalizeSingleValueOperator(operator: string): string {
  return API_TO_UI_OPERATOR[operator] ?? operator
}

function classifyMultiValueOperator(operator: string): 'any' | 'none' | undefined {
  if (operator === 'is-any-of' || operator === 'is any of' || operator === 'isAnyOf') {
    return 'any'
  }
  if (operator === 'is-none-of' || operator === 'is none of' || operator === 'isNoneOf') {
    return 'none'
  }
  return undefined
}

function evaluateMultiValuePredicate(
  rowStr: string,
  kind: 'any' | 'none',
  valStr: string
): boolean {
  const candidates = valStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const matches = candidates.some((candidate) => rowStr === candidate)
  return kind === 'any' ? matches : !matches
}
