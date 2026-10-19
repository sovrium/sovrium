/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The load-time rule of a lookup default (`defaultValue: { lookup: { table,
 * where } }`): it names a related row, so it sits on a `relationship` column
 * only, its `table` is the one that column points at, and its condition reads
 * a field that table has. Each refusal names the form, the field and the fix.
 */

import { isLookupDefault } from './form-lookup-default-service'

interface ColumnShape {
  readonly name: string
  readonly type?: string
  readonly relatedTable?: string
}

interface TableShape {
  readonly name: string
  readonly fields?: ReadonlyArray<ColumnShape>
}

interface FieldShape {
  readonly kind: string
  readonly column?: string
  readonly defaultValue?: unknown
}

interface FormShape {
  readonly name: string
  readonly submitTo: { readonly table?: string }
  readonly fields?: ReadonlyArray<FieldShape>
}

/** The fields a table has, the system `id` included: a lookup may match on it. */
const hasField = (table: TableShape | undefined, name: string): boolean =>
  name === 'id' || (table?.fields ?? []).some((field) => field.name === name)

/** Why ONE field's lookup default is refused, or `undefined` when it is sound. */
const lookupError = (
  field: FieldShape,
  column: ColumnShape | undefined,
  tables: ReadonlyArray<TableShape>
): string | undefined => {
  if (!isLookupDefault(field.defaultValue)) return undefined
  const { table, where } = field.defaultValue.lookup
  if (column?.type !== 'relationship') {
    return `a lookup defaultValue applies to a relationship column only; '${field.column ?? ''}' is not one — use a literal defaultValue or drop the lookup`
  }
  if (table !== column.relatedTable) {
    return `a lookup defaultValue must name table '${column.relatedTable ?? ''}', the table the relationship column points at, not '${table}'`
  }
  const related = tables.find((candidate) => candidate.name === table)
  return hasField(related, where.field)
    ? undefined
    : `the lookup condition reads field '${where.field}', which table '${table}' does not have`
}

/** The first refused lookup default across `forms`, or `undefined` when every one is sound. */
export const validateFormLookupDefaults = (
  forms: ReadonlyArray<FormShape>,
  tables: ReadonlyArray<TableShape>
): string | undefined =>
  forms
    .flatMap((form) => {
      const target = tables.find((table) => table.name === form.submitTo.table)
      return (form.fields ?? []).map((field, index) => {
        const column = target?.fields?.find((candidate) => candidate.name === field.column)
        const error = lookupError(field, column, tables)
        return error === undefined
          ? undefined
          : `form '${form.name}' fields[${index}] '${field.column ?? ''}': ${error}`
      })
    })
    .find((error) => error !== undefined)
