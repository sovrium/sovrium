/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The formula result types that store a number (`formulaResultTypeMap`).
 *
 * ONE list for the two rules that ask whether a formula's value is a number:
 * validation, which admits a `SUM` or `AVG` rolled up over such a formula, and
 * the grid, which draws that rollup as a figure. Shared so they cannot drift.
 */
export const NUMERIC_FORMULA_RESULT_TYPES: ReadonlySet<string> = new Set([
  'number',
  'decimal',
  'numeric',
  'integer',
  'int',
])

/** Whether a formula's declared `resultType` is a number (case-insensitive). */
export const isNumericFormulaResult = (resultType: unknown): boolean =>
  typeof resultType === 'string' && NUMERIC_FORMULA_RESULT_TYPES.has(resultType.toLowerCase())
