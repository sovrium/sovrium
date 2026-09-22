/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a `filter-bar` publishes, and in whose vocabulary.
 *
 * ─── A PRESENTATION UTIL, BECAUSE TWO TREES PUBLISH THE SAME EXPRESSION ────
 *
 * It sat inside the island until the SSR placeholder had to emit the opening
 * conditions too — the late-join capture a subscriber reads when it mounts
 * after the bar has already published its event. The two must produce the SAME
 * JSON or a grid that missed the event opens on a different filter from the one
 * the chips describe, so there is one builder rather than a copy per tree; and
 * `src/presentation/ui/**` may not import an island, which is what decides that
 * the one lives here.
 *
 * ─── THE SCHEMA'S OPERATORS ARE NOT THE ENDPOINT'S ─────────────────────────
 *
 * `FilterOperatorSchema` spells the eight operators `eq neq contains gt lt gte
 * lte in` — the vocabulary an author writes in `dataSource.filter[]` and the one
 * this bar's own `conditions[]` are decoded against. The records endpoint reads
 * a DIFFERENT set: `generateSqlConditionFragment` switches on `equals`,
 * `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`,
 * `lessThanOrEqual`, `contains`, `in` — and falls back to `=` for anything it
 * does not recognise.
 *
 * That fallback is why this translation is load-bearing rather than cosmetic.
 * A bar publishing `{"operator":"gt"}` produces `amount = '3000'`: no error, no
 * warning, a grid narrowed by the wrong predicate. `use-data-table-query.ts`
 * carries the same map for `dataSource.filter[]` and translates BEFORE building
 * its `?filter=`; the shared-filter bag bypasses that function entirely and
 * rides to the URL as a raw param, so the translation has to happen here.
 *
 * ─── AND THE VALUE IS TYPED FROM `kind`, NOT GUESSED ───────────────────────
 *
 * A condition's `value` is a string on the wire (the schema says so — one
 * control types it, one column receives it). A `number` field's value is
 * converted here anyway, because the bound parameter reaches SQL with whatever
 * type it left the browser with: `amount > '3000'` is coerced by SQLite's column
 * affinity and REFUSED by PostgreSQL, which has no `integer > text`. The bar
 * knows the `kind` the author declared, so it is the last place that can answer
 * the question before the dialect does.
 *
 * `in` is the other typed case: `buildInFragment` requires an ARRAY and renders
 * `IN (NULL)` — matching nothing — for anything else. The schema documents the
 * authored form as a comma-separated list, so it is split here.
 */

/** What a filterable field holds — `FilterFieldKindSchema`. */
export type FilterFieldKind = 'text' | 'number' | 'date' | 'select'

/** One choice offered for a `select` field. */
export interface FilterFieldOption {
  readonly value: string
  readonly label?: string
}

/** One field the bar offers, as it arrives in the island props. */
export interface FilterBarField {
  readonly name: string
  readonly label?: string
  readonly kind?: FilterFieldKind
  readonly options?: readonly FilterFieldOption[]
}

/** One condition the bar is holding. */
export interface FilterBarCondition {
  readonly field: string
  readonly operator: string
  readonly value: string
}

/**
 * Which operators each kind offers.
 *
 * Four lists rather than one shared one, because a single list offers the
 * operator that has no answer for the field: `contains` over a number is a
 * substring test on a quantity, and `greaterThan` over an enum asks which of two
 * unordered labels is larger. The names match the four categories the grid's own
 * builder sorts field types into, so the bar and the overlay offer the same
 * operators for the same field.
 */
export const OPERATORS_BY_KIND: Readonly<Record<FilterFieldKind, readonly string[]>> = {
  text: ['eq', 'neq', 'contains'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
  date: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'],
  select: ['eq', 'neq', 'in'],
}

/**
 * How each operator reads, in the words its FIELD KIND makes true.
 *
 * The four comparisons are the reason this is not one flat map. `gt` over a
 * date is "is after" and over a number is "is greater than", and a single table
 * has to pick one — which produced "Amount is after 3000" on a chip, a sentence
 * that is not wrong about the filter but is wrong about the quantity, and that
 * a reader has to translate back before they can trust it.
 *
 * `eq`, `neq`, `contains` and `in` read the same whatever they compare, so they
 * live in the shared base and are not restated per kind.
 */
const BASE_LABELS: Readonly<Record<string, string>> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  in: 'is any of',
}

const COMPARISON_LABELS: Readonly<Record<FilterFieldKind, Readonly<Record<string, string>>>> = {
  number: {
    gt: 'is greater than',
    lt: 'is less than',
    gte: 'is at least',
    lte: 'is at most',
  },
  date: { gt: 'is after', lt: 'is before', gte: 'is on or after', lte: 'is on or before' },
  // Neither offers a comparison — see `OPERATORS_BY_KIND` for why — so neither
  // needs a word for one.
  text: {},
  select: {},
}

/**
 * How one operator reads for one kind.
 *
 * Falls back to the operator's own token rather than to a guessed sentence: an
 * operator with no label is a vocabulary the bar has grown without telling this
 * map, and `gt` on a chip is honest where a wrong sentence is not.
 */
export const operatorLabel = (operator: string, kind: FilterFieldKind): string =>
  BASE_LABELS[operator] ?? COMPARISON_LABELS[kind][operator] ?? operator

/**
 * Schema operator -> records-API operator. See the module docstring: the
 * endpoint's fallback for an unknown operator is `=`, so a missing row here is
 * a silently wrong filter rather than a failure.
 */
const API_OPERATORS: Readonly<Record<string, string>> = {
  eq: 'equals',
  neq: 'notEquals',
  contains: 'contains',
  gt: 'greaterThan',
  lt: 'lessThan',
  gte: 'greaterThanOrEqual',
  lte: 'lessThanOrEqual',
  in: 'in',
}

/** The kind a field is filtered as. `text` when the author declared none. */
export function kindOf(field: FilterBarField | undefined): FilterFieldKind {
  return field?.kind ?? 'text'
}

/** The operators offered for one field. */
export function operatorsFor(field: FilterBarField | undefined): readonly string[] {
  return OPERATORS_BY_KIND[kindOf(field)]
}

/** What a field is called in the bar. Falls back to its column name. */
export function labelOf(field: FilterBarField | undefined, name: string): string {
  return field?.label ?? field?.name ?? name
}

/**
 * What a value reads as in a chip.
 *
 * A `select` value is looked up in the field's own `options` so the chip carries
 * the author's caption rather than the stored token — a reader filters on
 * "Paid", not on `paid`, and a chip that showed the token would be documenting
 * the column instead of the filter.
 */
export function displayValue(field: FilterBarField | undefined, value: string): string {
  const option = field?.options?.find((candidate) => candidate.value === value)
  return option?.label ?? option?.value ?? value
}

/** Coerce one authored value into the type the endpoint's SQL will bind. */
function typedValue(kind: FilterFieldKind, operator: string, value: string): unknown {
  if (operator === 'in') {
    const members = value
      .split(',')
      .map((member) => member.trim())
      .filter((member) => member.length > 0)
    return kind === 'number' ? members.map(Number) : members
  }
  if (kind !== 'number') return value
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : value
}

/** One condition, in the shape the SQL WHERE builder walks. */
function toLeaf(
  condition: FilterBarCondition,
  fields: readonly FilterBarField[]
): Readonly<Record<string, unknown>> {
  const field = fields.find((candidate) => candidate.name === condition.field)
  return {
    field: condition.field,
    operator: API_OPERATORS[condition.operator] ?? condition.operator,
    value: typedValue(kindOf(field), condition.operator, condition.value),
  }
}

/**
 * The JSON filter expression to publish, or `''` for no conditions.
 *
 * The empty string rather than `{"and":[]}`: an empty `and` group renders as
 * `(1 = 1)` server-side, which is harmless but sends a filter for no filter.
 * The publisher keeps the empty key in the merged bag (so the subscriber's query
 * key changes and it re-reads) and the fetch layer drops it from the URL — which
 * is exactly the "lift the last condition and see every row again" path.
 *
 * `or` publishes as a NESTED group. The endpoint's root node is an `and` and its
 * leaves nest, so a union has to be expressed as `{and:[{or:[…]}]}` — a flat
 * list of leaves under `and` is an intersection whatever the bar's combinator
 * says, and on the seeded invoice set the two answers differ by two rows.
 */
export function buildFilterExpression(
  conditions: readonly FilterBarCondition[],
  fields: readonly FilterBarField[],
  combinator: 'and' | 'or'
): string {
  if (conditions.length === 0) return ''
  const leaves = conditions.map((condition) => toLeaf(condition, fields))
  return JSON.stringify(combinator === 'or' ? { and: [{ or: leaves }] } : { and: leaves })
}
