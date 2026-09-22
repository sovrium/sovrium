/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { escapeRegExp } from '@/domain/kernel/sanitize/escape-regexp'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

/**
 * Numeric-cast primitives shared by every formula SQL path — the
 * GENERATED-ALWAYS-AS column generator (`sql-column-generators.ts`), the
 * BEFORE INSERT/UPDATE trigger generator (`formula-trigger-generators.ts` via
 * `formula-utils.ts`), and the VIEW generator (`view-formula-generators.ts`).
 *
 * Single source of truth so integer-by-integer division inside a numeric
 * formula (`heures + minutes / 60` over INTEGER columns) yields the true
 * fractional value (2.5) on BOTH dialects rather than truncating (2) —
 * [internal ref].
 *
 * IMPORTANT — the cast is applied ONLY to references that are direct operands
 * of a `/` division operator. Casting numeric references unconditionally
 * (wrapping EVERY integer column in `CAST(... AS NUMERIC)`) breaks formulas
 * that pass an integer column to a function expecting INTEGER —
 * `REPEAT(text, count)`, `CHR(code)` — and corrupts EXTRACT keyword tokens
 * (`EXTRACT(YEAR FROM …)`). Division is the only place integer arithmetic
 * silently truncates, so scoping the cast to `/` operands fixes the
 * truncation without disturbing any other formula.
 *
 * The cast runs as a POST-PASS over already-rendered references (bare
 * `minutes`, qualified `t.minutes`, or CTE-aliased `computed.minutes`) so it is
 * alias-agnostic and never interferes with the qualification/escaping step.
 */

/**
 * A field shape carrying enough info to decide numeric casting. `type` is
 * always present; `resultType` is only present on `formula` fields.
 */
export type NumericCastField = {
  readonly name: string
  readonly type: string
  readonly resultType?: string
}

/**
 * Field types whose values are numeric. A reference to one of these as a
 * division operand is cast to a floating/decimal SQL type so integer-by-integer
 * division (e.g. `minutes / 60`) yields a fractional result rather than
 * truncating.
 *
 * `rollup`/`count` are view-computed aggregates over numeric data (SUM/COUNT/…)
 * and therefore also numeric.
 */
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

/**
 * The dialect-appropriate floating type to cast numeric operands to so division
 * is non-truncating. Postgres `NUMERIC` and SQLite `REAL` both yield fractional
 * division results.
 */
export const numericCastType = (): string => (isSqliteRuntime() ? 'REAL' : 'NUMERIC')

/**
 * Whether a field reference should be cast to a numeric type so division over
 * INTEGER operands does not truncate. A `formula` field is numeric when its
 * `resultType` is a numeric kind; other fields are numeric per
 * {@link NUMERIC_FIELD_TYPES}.
 */
export const isNumericFieldRef = (field: NumericCastField): boolean => {
  if (field.type === 'formula') {
    return field.resultType !== undefined && NUMERIC_FORMULA_RESULT_TYPES.has(field.resultType)
  }
  return NUMERIC_FIELD_TYPES.has(field.type)
}

/**
 * Wrap each numeric column reference that is a DIRECT OPERAND of a `/` division
 * operator in a dialect-appropriate numeric CAST, so integer-by-integer
 * division does not truncate. Operates on already-rendered references — pass
 * `renderRef` to map a field name to its rendered form (bare `minutes`,
 * qualified `t.minutes`, or CTE-aliased `computed.minutes`).
 *
 * Only `/` operands are cast (see module docs): `minutes / 60` →
 * `CAST(minutes AS NUMERIC) / 60`, while `REPEAT(text, count)`, `CHR(code)`,
 * and `EXTRACT(YEAR FROM date_value)` are left untouched. Non-numeric fields
 * are never cast.
 *
 * The already-rendered reference is matched as a literal bounded by word/dot
 * boundaries (so `t.minutes` matches as a whole and a bare `minutes` does not
 * match inside `t.minutes`). A reference already wrapped in a CAST is skipped
 * because the wrapping `CAST(` is not a `/` operand.
 */
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
    // Left operand: `<ref> /` (the ref ends at a non-identifier boundary, then
    // optional whitespace, then `/`). Right operand: `/ <ref>`. The `(?<![\w.])`
    // / `(?![\w.])` boundaries prevent matching a suffix/prefix of a longer
    // identifier or a `t.<ref>` where `<ref>` is bare.
    const leftOperand = new RegExp(`(?<![\\w.])${refPattern}(?![\\w.(])(?=\\s*/)`, 'g')
    const rightOperand = new RegExp(`(?<=/\\s{0,8})(?<![\\w.])${refPattern}(?![\\w.(])`, 'g')
    return acc.replace(leftOperand, cast).replace(rightOperand, cast)
  }, formula)
