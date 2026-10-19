/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Refuse a form field `takenMessage` on a column that holds no value unique.
 *
 * The message is drawn only when the bound table refuses a value another
 * record already holds, so on a column without a uniqueness rule it would
 * never show — an author who wrote one expects a rule the table does not have.
 * A column is unique through its own `unique`, a single-field top-level
 * `unique` entry, or a single-field unique index — a set of several fields is
 * not, since a collision on a set is never drawn under one field. The column
 * is the one the field writes: its `submitTo.mapping` target when it has one.
 */

interface TakenMessageFormShape {
  readonly name: string
  readonly submitTo?: {
    readonly table?: string
    readonly mapping?: Readonly<Record<string, string>>
  }
  readonly fields?: readonly unknown[]
}

interface TakenMessageTableShape {
  readonly name: string
  readonly fields?: ReadonlyArray<{ readonly name: string; readonly unique?: boolean }>
  readonly unique?: ReadonlyArray<{ readonly fields: readonly string[] }>
  readonly indexes?: ReadonlyArray<{
    readonly fields: readonly string[]
    readonly unique?: boolean
  }>
}

/** Whether `table` holds `column` unique on its own. */
const holdsUnique = (table: TakenMessageTableShape, column: string): boolean =>
  (table.fields ?? []).some((field) => field.name === column && field.unique === true) ||
  (table.unique ?? []).some((entry) => entry.fields.length === 1 && entry.fields[0] === column) ||
  (table.indexes ?? []).some(
    (index) => index.unique === true && index.fields.length === 1 && index.fields[0] === column
  )

/** The first form field whose `takenMessage` names a column held unique by nothing, as its refusal. */
export const validateFormTakenMessages = (
  forms: readonly TakenMessageFormShape[],
  tables: readonly TakenMessageTableShape[]
): string | undefined =>
  forms.reduce<string | undefined>((acc, form) => {
    if (acc !== undefined) return acc
    const table = tables.find((candidate) => candidate.name === form.submitTo?.table)
    if (table === undefined) return undefined
    const written = (column: string): string => form.submitTo?.mapping?.[column] ?? column
    const refused = (form.fields ?? []).find((entry) => {
      const field = (entry ?? {}) as { readonly takenMessage?: unknown; readonly column?: unknown }
      return (
        field.takenMessage !== undefined &&
        typeof field.column === 'string' &&
        !holdsUnique(table, written(field.column))
      )
    }) as { readonly column: string } | undefined
    return refused === undefined
      ? undefined
      : `form '${form.name}' field '${refused.column}': takenMessage is shown only when a value is already taken, but column '${written(refused.column)}' of table '${table.name}' is not unique. Set \`unique: true\` on the column, or remove takenMessage.`
  }, undefined)
