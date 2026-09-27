/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pure half of "choices read from a table" on a hosted form: which fields
 * read a table, what query each one runs, and how the rows become choices.
 *
 * The read itself happens in the application layer (the form route) or the
 * page renderer (an embedded `formRef`); both call {@link optionSourceQuery}
 * and {@link rowsToOptions} so a form offers the same choices wherever it is
 * served. The query projects ONLY the two named columns — the rest of a row
 * has no destination on the page and must not travel (S4) — and reads live
 * rows only, so a soft-deleted row is never offered.
 *
 * The shapes are structural, like the rest of the forms helpers, so this
 * module takes no `tables` import (feature isolation).
 */

import {
  SELECT_OPTION_SOURCE_DEFAULT_LIMIT,
  SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD,
  type SelectOptionSource,
} from '../table-option-source'

/** One resolved choice: the value stored, and the text shown. */
export interface FormOptionItem {
  readonly value: string
  readonly label: string
}

/**
 * Resolved choices for one render, keyed by the field's submit identifier
 * (`column` for a table-bound field, `name` for a standalone one).
 */
export type FormOptionSets = Readonly<Record<string, ReadonlyArray<FormOptionItem>>>

/** A field that reads its choices from a table, and the source it reads. */
export interface FormOptionSourcePlan {
  readonly field: string
  readonly source: SelectOptionSource
}

/** The read a plan runs: one table, two columns, bounded, live rows only. */
export interface OptionSourceQuery {
  readonly table: string
  readonly options: {
    readonly fields: readonly string[]
    readonly filter?: SelectOptionSource['filter']
    readonly sort?: SelectOptionSource['sort']
    readonly pageSize: number
    readonly liveOnly: true
  }
}

interface FieldShape {
  readonly kind: string
  readonly name?: string
  readonly column?: string
  readonly hidden?: boolean
  readonly optionsSource?: SelectOptionSource
}

interface ColumnShape {
  readonly name: string
  readonly type?: string
  readonly relatedTable?: string
  readonly displayField?: string
}

interface TableShape {
  readonly name: string
  readonly fields?: ReadonlyArray<ColumnShape>
}

interface FormShape {
  readonly submitTo: { readonly table?: string }
  readonly fields: ReadonlyArray<FieldShape>
}

/**
 * Hard ceiling on one choice list, mirroring the schema's `limit` bound. The
 * list is served inside the page, so it stays bounded even for a config that
 * reached here without being decoded.
 */
const MAX_OPTIONS = 1000

/**
 * The source a `relationship` column offers when the field names none: the
 * related table's rows, labelled by the column's `displayField`, valued by
 * the row id. `undefined` when the column declares no `displayField` — the
 * boot refuses a visible field in that state, so only a hidden one reaches
 * here without a source.
 */
export const relationshipDefaultSource = (
  column: Readonly<ColumnShape>
): SelectOptionSource | undefined => {
  if (column.type !== 'relationship') return undefined
  if (typeof column.relatedTable !== 'string' || typeof column.displayField !== 'string') {
    return undefined
  }
  return {
    table: column.relatedTable,
    displayField: column.displayField,
    valueField: SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD,
  }
}

/**
 * The source ONE field reads its choices from, or `undefined` when its choices
 * are written in the config (or it offers none). A standalone field reads its
 * own `optionsSource`; a table-bound field over a `relationship` column reads
 * its override, else the column's default.
 */
export const fieldOptionSource = (
  field: Readonly<FieldShape>,
  column: Readonly<ColumnShape> | undefined
): SelectOptionSource | undefined => {
  if (field.kind === 'standalone') return field.optionsSource
  if (field.kind !== 'table-field' || column?.type !== 'relationship') return undefined
  return field.optionsSource ?? relationshipDefaultSource(column)
}

/**
 * Every field of `form` whose choices come from a table. A config-hidden field
 * is skipped: it renders a hidden input carrying its prefill, never a choice
 * list, so reading its table would be a query for nothing.
 */
export const collectFormOptionSources = (
  form: Readonly<FormShape>,
  tables: ReadonlyArray<TableShape>
): readonly FormOptionSourcePlan[] => {
  const target = tables.find((table) => table.name === form.submitTo.table)
  return form.fields.flatMap((field) => {
    if (field.hidden === true) return []
    const id = field.kind === 'table-field' ? field.column : field.name
    if (id === undefined) return []
    const column = target?.fields?.find((candidate) => candidate.name === field.column)
    const source = fieldOptionSource(field, field.kind === 'table-field' ? column : undefined)
    return source === undefined ? [] : [{ field: id, source }]
  })
}

/**
 * The most accounts one `user` picker offers. The list is served inside the
 * page, so it stays bounded whatever the size of the account directory; an
 * account past the bound is not offered.
 */
export const MAX_ACCOUNT_CHOICES = 500

/**
 * The submit identifiers of the visible fields of `form` bound to a `user`
 * column — the fields whose choices are the app's accounts. A config-hidden
 * field carries its prefill in a hidden input and offers no choice.
 */
export const collectFormUserColumns = (
  form: Readonly<FormShape>,
  tables: ReadonlyArray<TableShape>
): readonly string[] => {
  const target = tables.find((table) => table.name === form.submitTo.table)
  return form.fields.flatMap((field) => {
    if (field.kind !== 'table-field' || field.hidden === true || field.column === undefined) {
      return []
    }
    const column = target?.fields?.find((candidate) => candidate.name === field.column)
    return column?.type === 'user' ? [field.column] : []
  })
}

/**
 * The choice sets of `columns`, each offered the same `accounts` — the one
 * read of the account directory a render makes, whatever the number of user
 * fields.
 */
export const accountChoiceSets = (
  columns: readonly string[],
  accounts: readonly FormOptionItem[]
): FormOptionSets => Object.fromEntries(columns.map((column) => [column, accounts]))

/** The `valueField` a source stores — its own, or the row id. */
export const sourceValueField = (source: Readonly<SelectOptionSource>): string =>
  source.valueField ?? SELECT_OPTION_SOURCE_DEFAULT_VALUE_FIELD

/**
 * The read one source runs. `filter` is passed through as written: a
 * `$currentUser` reference is the caller's to resolve (it knows the session),
 * and a caller that cannot resolve one must not run the read at all.
 */
export const optionSourceQuery = (source: Readonly<SelectOptionSource>): OptionSourceQuery => {
  const valueField = sourceValueField(source)
  return {
    table: source.table,
    options: {
      fields: [...new Set([valueField, source.displayField])],
      ...(source.filter !== undefined && source.filter.length > 0 ? { filter: source.filter } : {}),
      ...(source.sort !== undefined ? { sort: source.sort } : {}),
      pageSize: Math.min(source.limit ?? SELECT_OPTION_SOURCE_DEFAULT_LIMIT, MAX_OPTIONS),
      liveOnly: true,
    },
  }
}

/**
 * Project one row into a choice.
 *
 * A row whose label or value is nullish is DROPPED rather than rendered as an
 * empty choice: a blank row in a dropdown is a control the user cannot reason
 * about, and `String(null)` would paint the literal text `null`.
 */
export const toOption = (
  row: Readonly<Record<string, unknown>>,
  displayField: string,
  valueField: string
): FormOptionItem | undefined => {
  const label = row[displayField]
  const value = row[valueField]
  if (label === null || label === undefined) return undefined
  if (value === null || value === undefined) return undefined
  return { label: String(label), value: String(value) }
}

/** Project the rows a source read into its choices, in the order they came. */
export const rowsToOptions = (
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
  source: Readonly<SelectOptionSource>
): readonly FormOptionItem[] => {
  const valueField = sourceValueField(source)
  return rows
    .map((row) => toOption(row, source.displayField, valueField))
    .filter((option): option is FormOptionItem => option !== undefined)
}
