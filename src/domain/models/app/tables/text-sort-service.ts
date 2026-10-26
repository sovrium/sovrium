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

import { declaresTranslatable } from './translatable-field-service'

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
  readonly languages?: { readonly default: string }
  readonly tables?: readonly {
    readonly name: string
    readonly fields: readonly unknown[]
  }[]
}

/**
 * A translatable text field, sorted by one language's value ignoring case: the
 * default language's, whatever the reader reads in ([internal ref] D8).
 */
export interface TranslatedSortKey {
  readonly field: string
  readonly language: string
}

/** A text field a sort compares ignoring case: by name, or by one language's value. */
export type CaseFoldedSortField = string | TranslatedSortKey

/**
 * The text fields of `tableName`, which a sort compares ignoring case. A
 * translatable field is compared by its default-language value.
 */
export const caseFoldedSortFieldsOf = (
  app: TablesView | undefined,
  tableName: string
): readonly CaseFoldedSortField[] =>
  (app?.tables?.find((table) => table.name === tableName)?.fields ?? []).flatMap(
    (field): readonly CaseFoldedSortField[] => {
      if (typeof field !== 'object' || field === null) return []
      const { name, type } = field as { readonly name?: unknown; readonly type?: unknown }
      if (typeof name !== 'string' || typeof type !== 'string') return []
      if (!CASE_FOLDED_SORT_FIELD_TYPES.has(type)) return []
      const language = app?.languages?.default
      return declaresTranslatable(field) && language !== undefined
        ? [{ field: name, language }]
        : [name]
    }
  )
