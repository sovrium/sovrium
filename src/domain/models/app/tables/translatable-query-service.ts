/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Querying a translatable field ([internal ref] D8, D9).
 *
 * A translatable field holds a map from language code to text, so a filter,
 * a sort or a search has to say WHICH text it compares. In this version:
 *
 * - a filter and a sort compare the DEFAULT language's value, whatever
 *   language the reader reads in;
 * - a search reads every language's value, so a word of any of them finds the
 *   record.
 *
 * A caller's condition on such a field is rewritten here into one the records
 * query compiles against that text ({@link TRANSLATED_TEXT_OPERATOR}); the SQL
 * that reads one language, or every language, out of the map is the
 * database's own concern.
 */

import { declaresTranslatable } from './translatable-field-service'

/** The operator a rewritten condition carries; its `field` is the translatable column. */
export const TRANSLATED_TEXT_OPERATOR = 'matchesTranslatedText'

/** The language a search reads: every value of the map. */
export const EVERY_LANGUAGE = '*'

/** What a rewritten condition carries: the caller's operator and value, and the text compared. */
export interface TranslatedTextValue {
  readonly operator: string
  readonly value?: unknown
  /** A language code, or {@link EVERY_LANGUAGE}. */
  readonly language: string
}

/** Whether a filter value is a rewritten translatable condition. */
export const isTranslatedTextValue = (value: unknown): value is TranslatedTextValue => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Readonly<Record<string, unknown>>
  return typeof candidate['operator'] === 'string' && typeof candidate['language'] === 'string'
}

/** The slice of an app this module reads. */
interface QueryApp {
  readonly languages?: { readonly default: string }
  readonly tables?: ReadonlyArray<{ readonly name: string; readonly fields: readonly object[] }>
}

/** The names of `tableName`'s translatable fields; empty for an app without languages. */
export const translatableFieldNamesOf = (
  app: QueryApp | undefined,
  tableName: string
): ReadonlySet<string> => {
  if (app?.languages === undefined) return new Set()
  const fields = app.tables?.find((table) => table.name === tableName)?.fields ?? []
  return new Set(
    fields
      .filter(declaresTranslatable)
      .map((field) => String((field as { readonly name?: unknown }).name))
  )
}

/**
 * Each translatable field of `tableName` with the language a filter, a sort or
 * a label reads it in: the app's default language. Empty without languages.
 */
export const defaultLanguageColumnsOf = (
  app: QueryApp | undefined,
  tableName: string
): Readonly<Record<string, string>> => {
  const language = app?.languages?.default
  return language === undefined
    ? {}
    : Object.fromEntries(
        [...translatableFieldNamesOf(app, tableName)].map((name) => [name, language])
      )
}

/** A condition on a translatable field, compared against `language`'s text. */
export const translatedCondition = (
  field: string,
  condition: { readonly operator: string; readonly value?: unknown },
  language: string
): {
  readonly field: string
  readonly operator: typeof TRANSLATED_TEXT_OPERATOR
  readonly value: TranslatedTextValue
} => ({
  field,
  operator: TRANSLATED_TEXT_OPERATOR,
  value: {
    operator: condition.operator,
    ...(condition.value === undefined ? {} : { value: condition.value }),
    language,
  },
})

/**
 * `filter` with every condition on a translatable field of `tableName`
 * compared against the field's default-language value, through `and` / `or`
 * groups. Every other node is returned as it came; a filter on a table with no
 * translatable field is returned unchanged.
 */
export function withDefaultLanguageConditions<T>(
  filter: T,
  context: { readonly app: QueryApp; readonly tableName: string }
): T {
  const names = translatableFieldNamesOf(context.app, context.tableName)
  const language = context.app.languages?.default
  if (names.size === 0 || language === undefined) return filter
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (typeof node !== 'object' || node === null) return node
    const record = node as Readonly<Record<string, unknown>>
    if (!('operator' in record)) {
      return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, rewrite(child)]))
    }
    const { field, operator } = record
    return typeof field === 'string' &&
      typeof operator === 'string' &&
      operator !== TRANSLATED_TEXT_OPERATOR &&
      names.has(field)
      ? translatedCondition(field, { operator, value: record['value'] }, language)
      : node
  }
  return rewrite(filter) as T
}
