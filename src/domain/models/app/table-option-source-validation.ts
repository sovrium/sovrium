/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The structural half of validating a table option source — shared by a page
 * `select` and a hosted form's `optionsSource`, which bind the same shape.
 *
 * Two things must hold, and neither can be said inside the schema because both
 * need `app.tables`: the source names a declared table, and its `displayField`
 * / `valueField` name real columns of it. `valueField` defaults to `'id'`,
 * which every table has implicitly, so the default is never checked against
 * `fields[]`. A typo'd `displayField` resolves every row to `undefined` and
 * renders a dropdown of blank rows — a control that boots and is useless — so
 * catching it offline in `sovrium validate` is the whole point.
 */

/** Minimal table shape the check reads. */
export interface TableForOptionSource {
  readonly name: string
  readonly fields?: ReadonlyArray<{ readonly name: string }>
}

/** The three keys of a table option source the structural check reads. */
export interface TableOptionSourceBinding {
  readonly table: string
  readonly displayField: string
  readonly valueField?: string | undefined
}

/**
 * Implicit primary key present on every table, so a `valueField` naming it is
 * valid even though it is absent from the authored `fields[]`.
 */
const IMPLICIT_FIELDS: ReadonlySet<string> = new Set(['id'])

/** A field name is known when the table declares it, or it is the implicit `id`. */
const isKnownField = (declared: ReadonlySet<string>, name: string): boolean =>
  declared.has(name) || IMPLICIT_FIELDS.has(name)

/** Human-readable tail listing the declared table names (or saying there are none). */
const availableTablesSuffix = (names: readonly string[]): string =>
  names.length > 0
    ? `. Available tables: ${names.toSorted().join(', ')}`
    : '. No tables are declared in app.tables[]'

/**
 * Check ONE table option source against `app.tables`.
 *
 * `subject` opens every message so the reader learns WHICH binding is wrong —
 * `Select option source` for a page control, the form and field for a hosted
 * form. Returns the message, or `undefined` when the binding resolves.
 */
export const validateTableOptionSourceBinding = (
  binding: TableOptionSourceBinding,
  tables: ReadonlyArray<TableForOptionSource>,
  subject: string
): string | undefined => {
  const { table, displayField, valueField } = binding
  const matched = tables.find((t) => t.name === table)
  if (!matched) {
    const suffix = availableTablesSuffix(tables.map((t) => t.name))
    return `${subject} references table '${table}' which is not declared in app.tables[]${suffix}`
  }

  const declared = new Set((matched.fields ?? []).map((f) => f.name))
  if (!isKnownField(declared, displayField)) {
    return `${subject} displayField '${displayField}' does not exist on table '${table}'`
  }
  if (valueField !== undefined && !isKnownField(declared, valueField)) {
    return `${subject} valueField '${valueField}' does not exist on table '${table}'`
  }
  return undefined
}
