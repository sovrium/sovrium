/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { API_TO_UI_OPERATOR } from './operator-vocabulary'

/**
 * Filter-builder operator vocabulary (PG-03 / [internal ref]..007).
 *
 * Operator values are the `<option value>` attribute the spec drives via
 * `page.getByRole('combobox', { name: /operator/i }).selectOption(value)`.
 * The label is the `<option>` text content, which the spec inspects via
 * `operator.locator('option').allTextContents()` to assert that text-fields
 * surface a `contains` operator and number-fields surface a `greater`/`>`/
 * `between` operator.
 *
 * Kept as a pure helper (no React, no hooks) so the FilterBuilder JSX and the
 * orchestrator's predicate-evaluation hook can both consume it without
 * incurring a re-render cost.
 *
 * ----------------------------------------------------------------------------
 * VOCABULARY CONTRACT (Cycle 5: save-views) — DO NOT BREAK BLINDLY
 * ----------------------------------------------------------------------------
 * Three operator vocabularies coexist in this codebase:
 *
 *   1. UI vocabulary (THIS FILE):
 *      Spaced English, human-readable. E.g. `'greater than'`, `'not equals'`,
 *      `'is any of'`, `'starts with'`. ~17 operators (see CONST blocks below).
 *
 *   2. API vocabulary (`src/presentation/islands/hooks/use-saved-views.ts`):
 *      camelCase. E.g. `'greaterThan'`, `'notEquals'`, `'contains'`. The
 *      shape saved views serialise to disk + send to the records API.
 *
 *   3. Domain vocabulary (`src/domain/.../data-source`):
 *      Short codes. E.g. `'gt'`, `'neq'`, `'contains'`. What `DataFilter`
 *      / `useDataTableQuery` expect for server-side narrowing.
 *
 * `use-saved-views.ts` already bridges 2 → 3 via `API_TO_DOMAIN_OPERATOR`.
 * When Cycle 5 (save-views) serialises `FilterRow[]` into a saved view, it
 * MUST bridge 1 → 2 explicitly — passing `'greater than'` straight to the
 * API will be silently dropped by `API_TO_DOMAIN_OPERATOR[...] ?? (... as ...)`
 * fallback and either ignored or rejected by the records endpoint.
 *
 * Note (do not retry): collapsing this UI vocabulary to camelCase to skip the
 * 1 → 2 bridge was considered but rejected — the `<option>` text content is
 * exposed to the user via `allTextContents()` assertions in the spec and is
 * the visible label in the operator combobox; renaming "greater than" to
 * "greaterThan" would break those specs AND the human-readable label.
 *
 * Multi-value operators (Phase 7 Cycle 2 — bridge closed):
 *   `evaluatePredicate` accepts `is-any-of` / `is-none-of` in ALL three
 *   vocabularies (UI spaced, API camelCase, domain hyphenated) so:
 *     - User-authored filters (UI `'is any of'`) filter correctly,
 *     - Saved-view loads (`FilterRow.operator = 'isAnyOf'` from JSONB) too,
 *     - Spec-direct wire injection (`'is-any-of'`) keeps working.
 *   See `classifyMultiValueOperator` for the dispatch table. The single-value
 *   bridge (1 → 2) still goes through `UI_TO_API_OPERATOR` on save.
 *
 * Single-value operators (Phase 7 Cycle 2 audit — bridge generalised):
 *   `evaluatePredicate` accepts the API-vocabulary form of every
 *   bidirectional operator (`'notEquals'`, `'greaterThan'`, `'lessThan'`,
 *   `'greaterThanOrEqual'`, `'lessThanOrEqual'`, `'doesNotContain'`,
 *   `'startsWith'`, `'endsWith'`, `'isBefore'`, `'isAfter'`) in addition to
 *   the UI spaced form. The bug class was identical to the multi-value one:
 *   `toFilterRows` (`use-saved-views-orchestration.ts`) stuffs the saved-view
 *   payload's API-vocabulary operator into `FilterRow.operator` verbatim, so
 *   loading a personal view authored with e.g. `'starts with'` (UI) →
 *   `'startsWith'` (API in JSONB) → `'startsWith'` (FilterRow) used to fall
 *   through `evaluatePredicate`'s string-family branch and silently no-op.
 *   See `normalizeSingleValueOperator` for the dispatch table.
 */

/** A single operator the filter builder exposes for a given field type. */
export interface FilterOperator {
  /** `<option value>` — what the spec passes to `selectOption()`. */
  readonly value: string
  /** `<option>` text content — what the spec greps for in `allTextContents()`. */
  readonly label: string
}

/**
 * Filter-builder field-type taxonomy.
 *
 * The schema's domain field types collapse into 4 categories for the
 * filter UI: text, number, date, and select (the enum-like single-/
 * multi-select / status families). Anything we don't recognise (or
 * undefined) falls back to text — the conservative default that still
 * surfaces the spec-asserted `contains` operator.
 */
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

/**
 * Map a domain field type literal (e.g. `'single-line-text'`, `'number'`,
 * `'single-select'`) to the broad operator category the filter UI uses.
 *
 * The fallback for unknown / undefined types is `'text'` — `contains` /
 * `is` are the safest superset of operators that work on stringified
 * values without lossy coercion.
 */
// eslint-disable-next-line complexity -- 4-branch dispatch over the domain field-type taxonomy; flattening into a Map would just trade one form of repetition for another
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

/**
 * Return the ordered list of operators the filter UI should render for a
 * field whose domain type is `fieldType`. The first entry is the sensible
 * default the FilterBuilder should pre-select.
 */
export function getOperatorsForType(fieldType: string | undefined): readonly FilterOperator[] {
  const category = categorize(fieldType)
  if (category === 'number') return NUMBER_OPERATORS
  if (category === 'date') return DATE_OPERATORS
  if (category === 'select') return SELECT_OPERATORS
  return TEXT_OPERATORS
}

/**
 * Whether the value input for a field should render as a `<select>` (with
 * the field's declared options as `<option>`s) instead of a plain text
 * `<input>`. Select-style values are required when the field is an enum-
 * like type (single-select / multi-select / status / boolean) AND the
 * declared `options` are non-empty.
 */
export function isSelectValueField(fieldType: string | undefined): boolean {
  return categorize(fieldType) === 'select'
}

/**
 * Evaluate a single (field, operator, value) predicate against a record.
 *
 * Operator vocabulary is normalised first (Phase 7 Cycle 2 audit): the API
 * camelCase forms persisted in saved-view JSONB are mapped to their UI
 * spaced-English equivalents so the dispatch below only has to know one form
 * per operator. Multi-value operators are recognised in all three vocabularies
 * (UI / API / domain hyphenated) via `classifyMultiValueOperator`.
 *
 * Numeric operators coerce the row value via `Number(...)` first; any
 * resulting `NaN` short-circuits to `false`. String operators coerce via
 * `String(...)` and compare case-insensitively. Unknown operators fail
 * closed (return `false`) — the spec only exercises the operators in the
 * vocabulary above, so unrecognised tags will never reach this path.
 */
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity, max-statements -- pure operator-dispatch over the canonical operator vocabulary; further extraction would just trade a function call for a function call
export function evaluatePredicate(rowValue: unknown, operator: string, value: string): boolean {
  const op = normalizeSingleValueOperator(operator)
  // Number-family operators
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
    return rowNum <= targetNum // less than or equal
  }
  // String-family operators (case-insensitive)
  const rowStr = String(rowValue ?? '').toLowerCase()
  const valStr = value.toLowerCase()
  if (op === 'is') return rowStr === valStr
  if (op === 'is not') return rowStr !== valStr
  if (op === 'contains') return rowStr.includes(valStr)
  if (op === 'does not contain') return !rowStr.includes(valStr)
  if (op === 'starts with') return rowStr.startsWith(valStr)
  if (op === 'ends with') return rowStr.endsWith(valStr)
  // Date-family operators (compared as strings — ISO 8601 sorts correctly
  // lexicographically when both sides are normalized; the runtime filter
  // builder authors date values as ISO strings via the date input).
  if (op === 'is before') return rowStr < valStr
  if (op === 'is after') return rowStr > valStr
  // Multi-value operators delegated to a sibling to keep `evaluatePredicate`
  // under the per-function statement cap.
  //
  // Accepts all three vocabulary forms (Phase 7 Cycle 2 — bridge fix):
  //   - UI vocabulary:     `'is any of'`, `'is none of'`   (from filter-overlay dropdown)
  //   - API vocabulary:    `'isAnyOf'`,   `'isNoneOf'`     (from saved-view JSONB payload)
  //   - Domain vocabulary: `'is-any-of'`, `'is-none-of'`   (from spec-direct wire format)
  // Without this multi-form recognition the UI-authored path silently no-ops
  // because `UI_TO_API_OPERATOR` translates `'is any of'` → `'isAnyOf'` and
  // saved-view ingestion forwards either form into `FilterRow.operator`
  // verbatim. See VOCABULARY CONTRACT block above for the full picture.
  const multiKind = classifyMultiValueOperator(op)
  if (multiKind !== undefined) {
    return evaluateMultiValuePredicate(rowStr, multiKind, valStr)
  }
  return false
}

/**
 * Map an API-vocabulary operator (camelCase, as persisted in saved-view JSONB)
 * to its UI-vocabulary equivalent (spaced English). Pass-through for operators
 * already in UI form. Pure dispatch — no allocation.
 *
 * The `API_TO_UI_OPERATOR` table is derived from the canonical forward map in
 * `operator-vocabulary.ts`, so this reverse direction can never drift from the
 * UI → API translation in `use-saved-views.ts`.
 */
function normalizeSingleValueOperator(operator: string): string {
  return API_TO_UI_OPERATOR[operator] ?? operator
}

/**
 * Normalize a multi-value operator from any of the three vocabularies into
 * its canonical kind (`'any'` or `'none'`), or `undefined` if `operator` is
 * not a multi-value form. Pure dispatch — no allocation.
 */
function classifyMultiValueOperator(operator: string): 'any' | 'none' | undefined {
  if (operator === 'is-any-of' || operator === 'is any of' || operator === 'isAnyOf') {
    return 'any'
  }
  if (operator === 'is-none-of' || operator === 'is none of' || operator === 'isNoneOf') {
    return 'none'
  }
  return undefined
}

/**
 * Evaluate the multi-value `is-any-of` / `is-none-of` operators
 * (PG-03 saved-view semantics).
 *
 * Values arrive as a comma-separated string because the FilterRow shape
 * carries `value: string`; shared-view ingestion stringifies the API's
 * `value: string[]` payload before reaching this predicate.
 */
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
