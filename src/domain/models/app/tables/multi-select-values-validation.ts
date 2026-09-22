/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical write-path rules for `multi-select` columns — option MEMBERSHIP
 * ("every selected value is one the column declares") and selection
 * CARDINALITY ("no more values than `maxSelections` allows") — shared by every
 * write path that accepts values for them.
 *
 * Why this module exists: neither rule was enforced at runtime anywhere.
 *
 * Membership was believed to be covered twice over and was in fact covered
 * once, on one engine. `sql/sql-check-constraints.ts` emits
 * `CHECK (col <@ ARRAY[...]::text[])` on PostgreSQL only — SQLite prohibits
 * subqueries inside CHECK and no subquery-free idiom expresses "every element
 * of a JSON array is in a fixed allowlist", so the constraint is dropped there.
 * The comment justifying that drop claimed application-layer validation
 * enforced the rule on writes instead; it did not. The `multi-select` field's
 * Effect Schema (`multi-select-field.ts`) validates the field CONFIG and never
 * sees a record value. Measured before this module was written: `POST
 * /api/tables/:t/records` with `{ tags: ['nonexistent'] }` returned 201 and
 * persisted on SQLite, and `PATCH` returned 200 and overwrote.
 *
 * Cardinality was inert on BOTH engines: the emitted CHECK tests membership
 * (`<@`) and never length, and the only `maxSelections` logic that existed was
 * the config-time consistency check (`maxSelections <= options.length`). A
 * three-value selection against `maxSelections: 2` was 201-and-persisted on
 * PostgreSQL and SQLite alike.
 *
 * Enforcing here rather than in the SQL generator is what makes the two engines
 * answer identically, and it upgrades PostgreSQL's answer from a sanitized
 * driver rejection naming no column into a field-scoped one an inline form
 * message can be rendered against.
 *
 * Callers own their own error envelope and user-facing copy — this module
 * reports WHICH columns were violated and by what, never how to phrase it.
 * Same split as {@link findColumnFormatViolations} in `column-formats.ts`, and
 * for the same reason: an API client is shown the column name, a stranger
 * filling in a public form is not.
 */

import { optionValue } from '@/domain/models/app/tables/select-option'

/** Minimal structural shape this module needs from a table's field list. */
type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

/** One `multi-select` column carrying values it does not declare as options. */
export type UndeclaredMultiSelectValues = {
  readonly field: string
  /** The selected values absent from `allowed`, in the order supplied. */
  readonly invalid: readonly string[]
  /** Every option VALUE the column declares (never a display label). */
  readonly allowed: readonly string[]
}

/** One `multi-select` column selecting more values than it permits. */
export type MultiSelectSelectionOverflow = {
  readonly field: string
  readonly maxSelections: number
  readonly selected: number
}

/**
 * The selected values a supplied column value represents.
 *
 * `undefined` / `null` mean NO SELECTION WAS SUPPLIED (or the column is being
 * cleared) and yield the empty list: emptiness is the `required` rule's
 * concern, and clearing an optional column must not report "invalid option".
 *
 * A NON-ARRAY value also yields the empty list, so neither rule fires on it.
 * That is deliberate rather than an oversight: a `multi-select` column is
 * array-valued on both engines (native `text[]` on PostgreSQL, JSON TEXT on
 * SQLite), so a scalar is a payload SHAPE error belonging to request decoding,
 * not a membership or cardinality violation — and inventing an answer here
 * would report "not a declared option" for something that was never a
 * selection at all.
 *
 * Non-string ELEMENTS are stringified rather than dropped. A numeric `1` in a
 * `multi-select` column is not a declared option, and silently ignoring it
 * would let it through the membership rule to be persisted.
 */
const selectedValues = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return []
  return value.map((element) => (typeof element === 'string' ? element : String(element)))
}

/**
 * Every option VALUE a column declares.
 *
 * Normalized through the shared {@link optionValue} helper, so the object
 * option form (`{ value, label }`, where `label` may be a `$t:` translation
 * key) is compared on its stable VALUE. Comparing on labels instead would
 * reject a legitimate selection the moment a column is translated, and would
 * admit a display label as if it were stored data.
 */
const declaredOptionValues = (field: FieldDeclaration): readonly string[] => {
  if (!('options' in field) || !Array.isArray(field.options)) return []
  return field.options.map(optionValue)
}

/**
 * Every `multi-select` column in `values` carrying at least one value the
 * column does not declare, in table field-declaration order.
 *
 * Only columns PRESENT in `values` are inspected (`field.name in values`).
 * This is a hard requirement, not an optimisation: it is what makes the rule
 * safe to run on a partial update. A row already holding an undeclared value
 * from before this rule existed must stay editable — validating absent columns
 * would make every write to an unrelated column of that row fail, turning a
 * legacy data problem into a hard outage.
 */
export const findUndeclaredMultiSelectValues = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly UndeclaredMultiSelectValues[] =>
  tableFields.flatMap((field) => {
    if (field.type !== 'multi-select' || !(field.name in values)) return []
    const allowed = declaredOptionValues(field)
    const invalid = selectedValues(values[field.name]).filter((value) => !allowed.includes(value))
    return invalid.length > 0 ? [{ field: field.name, invalid, allowed }] : []
  })

/**
 * Every `multi-select` column in `values` selecting more values than its
 * declared `maxSelections` permits, in table field-declaration order.
 *
 * The boundary is INCLUSIVE — a selection of exactly `maxSelections` is
 * allowed, which is what `maxSelections` means. A column without a declared
 * `maxSelections` is uncapped and never reported. Column presence is required
 * for the same partial-update reason as the membership rule above.
 */
export const findMultiSelectSelectionOverflows = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly MultiSelectSelectionOverflow[] =>
  tableFields.flatMap((field) => {
    if (field.type !== 'multi-select' || !(field.name in values)) return []
    if (!('maxSelections' in field) || typeof field.maxSelections !== 'number') return []
    const { maxSelections } = field
    const selected = selectedValues(values[field.name]).length
    return selected > maxSelections ? [{ field: field.name, maxSelections, selected }] : []
  })
