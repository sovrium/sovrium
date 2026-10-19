/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A relationship field's `defaultValue: { lookup: { table, where } }` — the
 * related row to start on, named by a stable attribute instead of its id.
 *
 * The lookup is read like a field's choices, because it IS one choice: the
 * first row of `table` meeting `where` (lowest id), read with the form's
 * authority under the visitor's row-level rule, on every serve. So it rides
 * the same plans as the choice lists ({@link lookupDefaultPlans}), under a key
 * of its own ({@link lookupDefaultKey}) that no field can be named, and the
 * starting values read the one choice it resolves to ({@link lookupDefaultOf}).
 * No match resolves to no choice, and the field starts empty.
 *
 * A HIDDEN field is filled by the server on submission too, so its lookup is
 * read again then and written into the form as the literal id it found
 * ({@link withResolvedLookupDefaults}), which every later step reads as an
 * ordinary default.
 */

import { SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD } from '../table-option-source'
import type { RecordLookupDefault, SelectOptionSource } from '../table-option-source'

/** One resolved choice, as the option sets carry it. */
interface ChoiceShape {
  readonly value: string
}

interface LookupFieldShape {
  readonly kind: string
  readonly column?: string
  readonly defaultValue?: unknown
}

/** Whether a `defaultValue` is a lookup rather than a literal or a reference. */
export const isLookupDefault = (value: unknown): value is RecordLookupDefault =>
  typeof value === 'object' &&
  value !== null &&
  'lookup' in value &&
  typeof (value as { readonly lookup?: unknown }).lookup === 'object'

/**
 * The option-set key a field's lookup resolves under. A `#` is not a character
 * a column name can hold, so the key never collides with a field's own choices.
 */
export const lookupDefaultKey = (column: string): string => `${column}#lookup`

/** The read ONE lookup runs, as a choice source: one row, valued and named by its id. */
export const lookupDefaultSource = (lookup: RecordLookupDefault['lookup']): SelectOptionSource => ({
  table: lookup.table,
  displayField: SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD,
  valueField: SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD,
  filter: [lookup.where],
  sort: [{ field: SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD, direction: 'asc' }],
  limit: 1,
})

/** One table-bound field whose default is a lookup. */
interface LookupField {
  readonly column: string
  readonly lookup: RecordLookupDefault['lookup']
  readonly hidden: boolean
}

/** Every table-bound field of `form` whose default is a lookup, in field order. */
const lookupFields = (form: {
  readonly fields: ReadonlyArray<LookupFieldShape & { readonly hidden?: boolean }>
}): readonly LookupField[] =>
  form.fields.flatMap((field) =>
    field.kind === 'table-field' &&
    field.column !== undefined &&
    isLookupDefault(field.defaultValue)
      ? [{ column: field.column, lookup: field.defaultValue.lookup, hidden: field.hidden === true }]
      : []
  )

/** One read plan per table-bound field of `form` whose default is a lookup. */
export const lookupDefaultPlans = (form: {
  readonly fields: ReadonlyArray<LookupFieldShape>
}): readonly { readonly field: string; readonly source: SelectOptionSource }[] =>
  lookupFields(form).map(({ column, lookup }) => ({
    field: lookupDefaultKey(column),
    source: lookupDefaultSource(lookup),
  }))

/**
 * The id a field's lookup resolved to in `optionSets`, or `undefined` when it
 * found no row — or was not read, so the field starts empty either way.
 */
export const lookupDefaultOf = (
  column: string,
  optionSets: Readonly<Record<string, ReadonlyArray<ChoiceShape>>> | undefined
): string | undefined => optionSets?.[lookupDefaultKey(column)]?.[0]?.value

/** The table-bound fields of `form` that are hidden and start on a lookup, by column. */
export const hiddenLookupFields = (form: {
  readonly fields: ReadonlyArray<LookupFieldShape & { readonly hidden?: boolean }>
}): readonly Omit<LookupField, 'hidden'>[] =>
  lookupFields(form).flatMap(({ column, lookup, hidden }) => (hidden ? [{ column, lookup }] : []))

/**
 * `form` with each hidden lookup default replaced by the id it resolved to in
 * `found` (keyed by column), and dropped when it found none — so a hidden
 * field with no matching row files the record under nothing.
 */
export const withResolvedLookupDefaults = <
  F extends { readonly fields: ReadonlyArray<LookupFieldShape & { readonly hidden?: boolean }> },
>(
  form: F,
  found: Readonly<Record<string, string>>
): F => {
  const hidden = new Set(hiddenLookupFields(form).map((field) => field.column))
  if (hidden.size === 0) return form
  const fields = form.fields.map((field) => {
    if (field.column === undefined || !hidden.has(field.column)) return field
    const { defaultValue: _lookup, ...rest } = field
    const id = found[field.column]
    return id === undefined ? rest : { ...rest, defaultValue: id }
  })
  return { ...form, fields }
}
