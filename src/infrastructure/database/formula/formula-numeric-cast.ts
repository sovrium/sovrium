/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'


export type NumericCastField = {
  readonly name: string
  readonly type: string
  readonly resultType?: string
}

const NUMERIC_FIELD_TYPES = new Set([
  'integer',
  'autonumber',
  'decimal',
  'number',
  'numeric',
  'currency',
  'percentage',
  'rating',
  'progress',
  'count',
  'rollup',
])

const NUMERIC_FORMULA_RESULT_TYPES = new Set([
  'integer',
  'decimal',
  'number',
  'numeric',
  'currency',
  'percentage',
])

export const numericCastType = (): string => (isSqliteRuntime() ? 'REAL' : 'NUMERIC')

export const isNumericFieldRef = (field: NumericCastField): boolean => {
  if (field.type === 'formula') {
    return field.resultType !== undefined && NUMERIC_FORMULA_RESULT_TYPES.has(field.resultType)
  }
  return NUMERIC_FIELD_TYPES.has(field.type)
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const castDivisionOperands = (
  formula: string,
  allFields: readonly NumericCastField[],
  renderRef: (fieldName: string) => string
): string =>
  allFields.reduce((acc, field) => {
    if (!isNumericFieldRef(field)) return acc
    const ref = renderRef(field.name)
    const refPattern = escapeRegExp(ref)
    const cast = `CAST(${ref} AS ${numericCastType()})`
    const leftOperand = new RegExp(`(?<![\\w.])${refPattern}(?![\\w.(])(?=\\s*/)`, 'g')
    const rightOperand = new RegExp(`(?<=/\\s{0,8})(?<![\\w.])${refPattern}(?![\\w.(])`, 'g')
    return acc.replace(leftOperand, cast).replace(rightOperand, cast)
  }, formula)
