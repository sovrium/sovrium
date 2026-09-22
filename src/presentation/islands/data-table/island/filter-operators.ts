/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Filter-builder operator vocabulary (PG-03 / [internal ref]..007).
 *
 * ----------------------------------------------------------------------------
 * ONE VOCABULARY — the canonical spelling is the WIRE spelling
 * ----------------------------------------------------------------------------
 * `equals`, `notEquals`, `contains`, `doesNotContain`, `startsWith`,
 * `endsWith`, `greaterThan`, `lessThan`, `greaterThanOrEqual`,
 * `lessThanOrEqual`, `isBefore`, `isAfter`, `isAnyOf`, `isNoneOf`, `between`.
 * That is the spelling the saved-view wire schema names, the spelling
 * `closed-vocabulary.ts` gives a developer writing `views[].filters`, and now
 * the spelling the builder emits from the moment the user picks an operator.
 *
 * The spaced English form (`is`, `greater than`, `starts with`) survives ONLY
 * as a human LABEL — the `<option>` text content. It is never an operator
 * value, is never persisted, and never reaches `evaluatePredicate` from the
 * builder.
 *
 * This replaced three coexisting vocabularies bridged by two rename tables
 * pointing in opposite directions. The bridge was lossy in both halves: `is`
 * was renamed to `equals` on save and nothing renamed it back on load, and
 * `is not` / `not equals` both collapsed onto `notEquals` so the derived
 * reverse map could only ever restore one of them. A view saved on a text or
 * select column therefore matched nothing when it was re-opened. Do not
 * reintroduce a translation step in either direction to paper over a spelling
 * mismatch — fix the spelling.
 *
 * ----------------------------------------------------------------------------
 * THE COMPARISON FAMILY COMES FROM THE FIELD TYPE, NOT FROM THE SPELLING
 * ----------------------------------------------------------------------------
 * `equals` / `notEquals` are legitimately shared by number, text, select and
 * date columns, so no operator spelling can carry the comparison family. They
 * take it from the field's declared type instead, threaded into
 * `evaluatePredicate` from the `fieldMeta` the island already holds. Reading
 * the family off the spelling is what made a reloaded `equals` compute
 * `Number('Alice')`, get `NaN`, and fail closed on every row.
 *
 * The ORDERED comparisons (`greaterThan` and friends) are the exception, and
 * only because the builder offers them on number columns alone — there the
 * spelling really does determine the family.
 *
 * Kept as a pure helper (no React, no hooks) so the FilterBuilder JSX and the
 * orchestrator's predicate-evaluation hook can both consume it without
 * incurring a re-render cost.
 */

/** A single operator the filter builder exposes for a given field type. */
export interface FilterOperator {
  /**
   * `<option value>` — the CANONICAL operator. What the builder commits into a
   * `FilterRow`, and what crosses the wire verbatim.
   */
  readonly value: string
  /**
   * `<option>` text content — the human-readable label, which the spec greps
   * for in `allTextContents()`. Playwright's `selectOption(<string>)` matches
   * value OR label, so a spec may drive this dropdown by either.
   */
  readonly label: string
}

/**
 * Filter-builder field-type taxonomy.
 *
 * The schema's domain field types collapse into 4 categories for the
 * filter UI: text, number, date, and select (the enum-like single-/
 * multi-select / status families). Anything we don't recognise (or
 * undefined) falls back to text — the conservative default that still
 * surfaces the spec-asserted `contains` operator, and the comparison mode
 * that cannot coerce a value into `NaN`.
 */
type OperatorCategory = 'text' | 'number' | 'date' | 'select'

const TEXT_OPERATORS: readonly FilterOperator[] = [
  { value: 'equals', label: 'is' },
  { value: 'notEquals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'doesNotContain', label: 'does not contain' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
]

const NUMBER_OPERATORS: readonly FilterOperator[] = [
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'not equals' },
  { value: 'greaterThan', label: 'greater than' },
  { value: 'lessThan', label: 'less than' },
  { value: 'greaterThanOrEqual', label: 'greater than or equal' },
  { value: 'lessThanOrEqual', label: 'less than or equal' },
  { value: 'between', label: 'between' },
]

const DATE_OPERATORS: readonly FilterOperator[] = [
  { value: 'equals', label: 'is' },
  { value: 'notEquals', label: 'is not' },
  { value: 'isBefore', label: 'is before' },
  { value: 'isAfter', label: 'is after' },
  { value: 'between', label: 'between' },
]

const SELECT_OPERATORS: readonly FilterOperator[] = [
  { value: 'equals', label: 'is' },
  { value: 'notEquals', label: 'is not' },
  { value: 'isAnyOf', label: 'is any of' },
  { value: 'isNoneOf', label: 'is none of' },
]

/**
 * The operator a fresh filter row falls back to when its field offers an empty
 * operator list — which no category does, so this is a type-level floor rather
 * than a reachable branch.
 */
export const DEFAULT_FILTER_OPERATOR = 'equals'

/**
 * The domain field types that are NOT plain text, and the category each falls
 * into. A table rather than a branch chain: the taxonomy is data, and reading
 * it as data makes the whole mapping visible at once instead of spread over
 * eleven `===` comparisons.
 *
 * A `Map` rather than an object literal, deliberately. `fieldType` is a lookup
 * KEY taken from author-supplied config, and indexing an object literal by one
 * resolves inherited `Object.prototype` members — `'constructor'` would answer
 * with a function rather than with `undefined`, defeating the `?? 'text'`
 * fallback and returning something that is not an `OperatorCategory` at all. A
 * `Map` has no inherited keys, so the fallback is total.
 *
 * Everything absent from this table is text — see {@link categorize}.
 */
const CATEGORY_BY_FIELD_TYPE: ReadonlyMap<string, OperatorCategory> = new Map([
  ['number', 'number'],
  ['currency', 'number'],
  ['percent', 'number'],
  ['date', 'date'],
  ['datetime', 'date'],
  ['time', 'date'],
  ['single-select', 'select'],
  ['multi-select', 'select'],
  ['status', 'select'],
  ['boolean', 'select'],
  ['checkbox', 'select'],
])

/**
 * Map a domain field type literal (e.g. `'single-line-text'`, `'number'`,
 * `'single-select'`) to the broad operator category the filter UI uses.
 *
 * The fallback for unknown / undefined types is `'text'` — `contains` /
 * `equals` are the safest superset of operators that work on stringified
 * values without lossy coercion. An empty string falls through the same way an
 * absent type does, since no entry is keyed by one.
 */
function categorize(fieldType: string | undefined): OperatorCategory {
  return CATEGORY_BY_FIELD_TYPE.get(fieldType ?? '') ?? 'text'
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
 * Alternate operator spellings a filter row can carry when it did NOT come
 * from the builder, folded onto the canonical vocabulary before dispatch.
 *
 * This is INPUT TOLERANCE at one edge, not a second vocabulary. A saved view's
 * `filters[]` is author-supplied JSON: an API caller, a shared-link payload or
 * a spec may write `'is'`, or the hyphenated domain form `'is-any-of'`,
 * straight into the wire payload, and those rows reach `evaluatePredicate`
 * verbatim through `toFilterRows`. Every entry maps an alias ONTO the
 * canonical form — the direction the canonical decision already points — so no
 * rename ever travels back out towards the wire.
 */
const OPERATOR_ALIASES: Readonly<Record<string, string>> = {
  is: 'equals',
  'is not': 'notEquals',
  'not equals': 'notEquals',
  'greater than': 'greaterThan',
  'less than': 'lessThan',
  'greater than or equal': 'greaterThanOrEqual',
  'less than or equal': 'lessThanOrEqual',
  'does not contain': 'doesNotContain',
  'starts with': 'startsWith',
  'ends with': 'endsWith',
  'is before': 'isBefore',
  'is after': 'isAfter',
  'is any of': 'isAnyOf',
  'is none of': 'isNoneOf',
  'is-any-of': 'isAnyOf',
  'is-none-of': 'isNoneOf',
}

/** Fold an author-supplied operator onto the canonical vocabulary. */
function canonicalizeOperator(operator: string): string {
  return OPERATOR_ALIASES[operator] ?? operator
}

/** The four ordered comparisons, which only a number column ever offers. */
function isOrderedComparison(op: string): boolean {
  return (
    op === 'greaterThan' ||
    op === 'lessThan' ||
    op === 'greaterThanOrEqual' ||
    op === 'lessThanOrEqual'
  )
}

/**
 * Compare two operands numerically. An operand that does not parse fails the
 * predicate closed rather than comparing as `NaN` — which is false for every
 * operator including `!==`, so a negation would otherwise match everything.
 */
function evaluateNumeric(rowValue: unknown, op: string, value: string): boolean {
  const rowNum = Number(rowValue)
  const targetNum = Number(value)
  if (Number.isNaN(rowNum) || Number.isNaN(targetNum)) return false
  if (op === 'equals') return rowNum === targetNum
  if (op === 'notEquals') return rowNum !== targetNum
  if (op === 'greaterThan') return rowNum > targetNum
  if (op === 'lessThan') return rowNum < targetNum
  if (op === 'greaterThanOrEqual') return rowNum >= targetNum
  return rowNum <= targetNum // lessThanOrEqual
}

/**
 * Equality, which every family shares — so the FIELD TYPE decides the mode
 * rather than the spelling. A number column compares numerically; everything
 * else compares as a case-insensitive string, the mode that cannot coerce a
 * value into `NaN`.
 */
function evaluateEquality(
  rowValue: unknown,
  op: 'equals' | 'notEquals',
  value: string,
  fieldType: string | undefined
): boolean {
  if (categorize(fieldType) === 'number') return evaluateNumeric(rowValue, op, value)
  const isEqual = String(rowValue ?? '').toLowerCase() === value.toLowerCase()
  return op === 'equals' ? isEqual : !isEqual
}

/**
 * The substring/affix operators, plus the two date comparisons that are also
 * string comparisons — ISO 8601 sorts correctly lexicographically when both
 * sides are normalized, and the runtime filter builder authors date values as
 * ISO strings via the date input.
 *
 * `undefined` means "not one of mine", so the caller can go on to the
 * multi-value family. Same shape as {@link classifyMultiValueOperator} beside
 * it: one family per sibling, dispatched from one place.
 */
function evaluateStringPredicate(rowStr: string, op: string, valStr: string): boolean | undefined {
  if (op === 'contains') return rowStr.includes(valStr)
  if (op === 'doesNotContain') return !rowStr.includes(valStr)
  if (op === 'startsWith') return rowStr.startsWith(valStr)
  if (op === 'endsWith') return rowStr.endsWith(valStr)
  if (op === 'isBefore') return rowStr < valStr
  if (op === 'isAfter') return rowStr > valStr
  return undefined
}

/**
 * Evaluate a single (field, operator, value) predicate against a record.
 *
 * `operator` is the canonical vocabulary; a legacy or domain spelling arriving
 * from an author-supplied payload is folded onto it first (see
 * {@link OPERATOR_ALIASES}).
 *
 * `fieldType` is the field's declared domain type and decides how `equals` /
 * `notEquals` compare — numerically on a number column, as a case-insensitive
 * string everywhere else. Omitting it is safe and degrades to the string
 * comparison, the mode that cannot coerce a value into `NaN`.
 *
 * String operators coerce via `String(...)` and compare case-insensitively.
 * Unknown operators fail closed (return `false`).
 *
 * Each operator FAMILY is a sibling function above, so this stays a dispatch
 * over four families rather than over fifteen spellings.
 */
export function evaluatePredicate(
  rowValue: unknown,
  operator: string,
  value: string,
  fieldType?: string
): boolean {
  const op = canonicalizeOperator(operator)
  // Ordered comparisons: offered on number columns only, so here — and only
  // here — the spelling does determine the family.
  if (isOrderedComparison(op)) return evaluateNumeric(rowValue, op, value)
  if (op === 'equals' || op === 'notEquals') {
    return evaluateEquality(rowValue, op, value, fieldType)
  }
  // String-family operators (case-insensitive)
  const rowStr = String(rowValue ?? '').toLowerCase()
  const valStr = value.toLowerCase()
  const asString = evaluateStringPredicate(rowStr, op, valStr)
  if (asString !== undefined) return asString
  const multiKind = classifyMultiValueOperator(op)
  if (multiKind !== undefined) {
    return evaluateMultiValuePredicate(rowStr, multiKind, valStr)
  }
  return false
}

/**
 * Narrow a canonical multi-value operator to its kind (`'any'` or `'none'`),
 * or `undefined` when `operator` is not a multi-value form. Pure dispatch —
 * no allocation. Alias spellings are already folded onto the canonical form by
 * {@link canonicalizeOperator} before this is reached.
 */
function classifyMultiValueOperator(operator: string): 'any' | 'none' | undefined {
  if (operator === 'isAnyOf') return 'any'
  if (operator === 'isNoneOf') return 'none'
  return undefined
}

/**
 * Evaluate the multi-value `isAnyOf` / `isNoneOf` operators
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
