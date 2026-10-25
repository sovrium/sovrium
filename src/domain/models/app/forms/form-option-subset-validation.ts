/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Refuse a table field's `options` list that cannot mean what its author wrote.
 *
 * The list names the values of a select column a form offers, so each refusal
 * names the form, the field and the value at fault:
 *
 *  - `options` on a column that is not a `single-select` or `multi-select`;
 *  - a listed value the column does not hold;
 *  - a value listed twice;
 *  - a literal field `defaultValue` outside the list (a reference such as
 *    `$query.plan` names nothing until the form is opened, and is held to the
 *    list at submit; a column-level `default` outside it stays the operator's
 *    choice, and is not refused);
 *  - a `submitTo.mapping` entry writing a narrowed column from another field,
 *    or carrying the narrowing field to another column: the list was checked
 *    against its own column, so that column has one writer only.
 */

import { isReferenceDefaultValue } from './form-field-helpers'
import { NARROWABLE_COLUMN_TYPES, type FormChoiceShape } from './form-option-subset-service'

interface SubsetFieldShape {
  readonly kind: string
  readonly column?: string
  readonly options?: ReadonlyArray<FormChoiceShape>
  readonly defaultValue?: unknown
}

interface SubsetFormShape {
  readonly name: string
  readonly submitTo?: {
    readonly table?: string
    readonly mapping?: Readonly<Record<string, string>>
  }
  readonly fields?: ReadonlyArray<SubsetFieldShape>
}

interface SubsetTableShape {
  readonly name: string
  readonly fields?: ReadonlyArray<{
    readonly name: string
    readonly type?: string
    readonly options?: unknown
  }>
}

/** A column's option values, whichever shape (bare string or `{ value }`) it declares them in. */
const columnValues = (options: unknown): ReadonlySet<string> =>
  new Set(
    (Array.isArray(options) ? options : []).map((option: unknown) =>
      typeof option === 'string' ? option : String((option as { readonly value?: unknown }).value)
    )
  )

/**
 * The values a literal field `defaultValue` names: each entry of a multi-select's
 * comma list. A reference names none yet, so it yields nothing.
 */
const defaultValues = (value: unknown, columnType: string | undefined): readonly string[] => {
  if (value === undefined || value === null || typeof value === 'object') return []
  if (isReferenceDefaultValue(value)) return []
  const text = String(value)
  return columnType === 'multi-select'
    ? text
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '')
    : [text]
}

/** The first value of `values` already listed before it. */
const firstRepeat = (values: readonly string[]): string | undefined =>
  values.find((value, index) => values.indexOf(value) !== index)

/** The refusal for one field's `options`, or `undefined` when the list holds. */
const refuseFieldOptions = (
  form: SubsetFormShape,
  field: SubsetFieldShape & {
    readonly column: string
    readonly options: ReadonlyArray<FormChoiceShape>
  },
  table: SubsetTableShape
): string | undefined => {
  const where = `form '${form.name}' field '${field.column}'`
  const column = table.fields?.find((candidate) => candidate.name === field.column)
  if (column === undefined) return undefined
  if (!NARROWABLE_COLUMN_TYPES.has(column.type ?? '')) {
    return `${where}: options lists the choices a single-select or multi-select column offers, but column '${field.column}' is a ${column.type ?? 'column without options'}. Remove options from this field.`
  }
  const held = columnValues(column.options)
  const listed = field.options.map((choice) => choice.value)
  const stray = listed.find((value) => !held.has(value))
  if (stray !== undefined) {
    return `${where}: options lists '${stray}', which is not an option of column '${field.column}'. Each value in options must be one of the column's options.`
  }
  const repeat = firstRepeat(listed)
  if (repeat !== undefined) {
    return `${where}: options lists '${repeat}' more than once. List each value once.`
  }
  const offered = new Set(listed)
  const outside = defaultValues(field.defaultValue, column.type).find(
    (value) => !offered.has(value)
  )
  return outside === undefined
    ? undefined
    : `${where}: defaultValue '${outside}' is not one of the values options offers. Add it to options, or choose a listed value.`
}

/** The first refused `options` list among `form`'s table fields, as its refusal. */
const refuseFormOptions = (form: SubsetFormShape, table: SubsetTableShape): string | undefined =>
  (form.fields ?? []).reduce<string | undefined>((found, field) => {
    if (found !== undefined) return found
    if (field.kind !== 'table-field' || field.column === undefined) return undefined
    if (field.options === undefined) return undefined
    return refuseFieldOptions(
      form,
      { ...field, column: field.column, options: field.options },
      table
    )
  }, undefined)

/** The columns of `table` a field of `form` narrows with `options`. */
const narrowedColumns = (form: SubsetFormShape, table: SubsetTableShape): ReadonlySet<string> =>
  new Set(
    (form.fields ?? []).flatMap((field) =>
      field.kind === 'table-field' &&
      field.column !== undefined &&
      field.options !== undefined &&
      (table.fields ?? []).some((column) => column.name === field.column)
        ? [field.column]
        : []
    )
  )

/**
 * The first `submitTo.mapping` entry that gives a narrowed column a second
 * writer — another field mapped onto it — or carries the narrowing field to
 * another column, as its refusal.
 */
const refuseNarrowedMapping = (
  form: SubsetFormShape,
  table: SubsetTableShape
): string | undefined => {
  const narrowed = narrowedColumns(form, table)
  const entry = Object.entries(form.submitTo?.mapping ?? {}).find(
    ([source, target]) => source !== target && (narrowed.has(target) || narrowed.has(source))
  )
  if (entry === undefined) return undefined
  const [source, target] = entry
  return narrowed.has(target)
    ? `form '${form.name}' field '${source}': submitTo.mapping writes column '${target}', which field '${target}' narrows with options. A narrowed column is written only by the field that narrows it: remove this mapping entry.`
    : `form '${form.name}' field '${source}': submitTo.mapping carries it to column '${target}', but its options were checked against column '${source}'. A field that narrows its column with options is written to that column only: remove this mapping entry.`
}

/** The first table field whose `options` list, or a mapping around it, is refused, as its refusal. */
export const validateFormOptionSubsets = (
  forms: ReadonlyArray<SubsetFormShape>,
  tables: ReadonlyArray<SubsetTableShape>
): string | undefined =>
  forms.reduce<string | undefined>((acc, form) => {
    if (acc !== undefined) return acc
    const table = tables.find((candidate) => candidate.name === form.submitTo?.table)
    if (table === undefined) return undefined
    return refuseFormOptions(form, table) ?? refuseNarrowedMapping(form, table)
  }, undefined)
