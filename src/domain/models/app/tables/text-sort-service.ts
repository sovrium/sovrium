/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which fields of a table a list sort compares IGNORING CASE.
 *
 * A reader sorting a list by name expects the alphabet: "atelier nord" before
 * "Brasserie Martin", whatever the capitals. Comparing the stored bytes puts
 * every capital before every lower-case letter, and how a database collates
 * text by default differs between engines and between installs — so the sort
 * folds the case of a text field explicitly, and of a text field only: a date,
 * a number or an option keeps its own order.
 */

/** Field types holding free text a reader sorts alphabetically. */
const CASE_FOLDED_SORT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
  'phone-number',
])

/** Minimal shape this module reads of an app: each table's name and field types. */
interface TablesView {
  readonly tables?: readonly {
    readonly name: string
    readonly fields: readonly unknown[]
  }[]
}

/** The names of `tableName`'s text fields, which a sort compares ignoring case. */
export const caseFoldedSortFieldsOf = (
  app: TablesView | undefined,
  tableName: string
): readonly string[] =>
  (app?.tables?.find((table) => table.name === tableName)?.fields ?? []).flatMap((field) => {
    const { name, type } = (field ?? {}) as { readonly name?: unknown; readonly type?: unknown }
    return typeof name === 'string' &&
      typeof type === 'string' &&
      CASE_FOLDED_SORT_FIELD_TYPES.has(type)
      ? [name]
      : []
  })
