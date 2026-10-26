/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  declaresTranslatable,
  isLanguageMapShape,
  recordLanguageOrder,
  type LanguageMap,
} from './translatable-field-service'
import type { App } from '@/domain/models/app'

/**
 * Writing a translatable field one language at a time.
 *
 * A write never replaces a translatable field's map: it MERGES into it. A
 * plain string is the value of one language (the writer's active language),
 * an object names each language it changes, and a language set to `null` or
 * `''` is removed. Every other language the record holds is kept.
 *
 * A write is therefore carried, from the request to the statement, as a
 * {@link LanguageMerge}: the languages it sets and the languages it removes.
 * The statement applies it to the stored map in one expression, so two
 * writers editing two languages of one record at once both keep their change.
 */

const LANGUAGE_MERGE: unique symbol = Symbol.for('sovrium.languageMerge')

/**
 * A write to a translatable field as the statement applies it: the languages
 * it sets, and the languages it removes, merged into whatever the record
 * stores. On a create there is nothing stored, so it is the map it sets.
 */
export interface LanguageMerge {
  readonly [LANGUAGE_MERGE]: true
  readonly set: LanguageMap
  readonly remove: readonly string[]
}

/** The names of the translatable fields of `tableName`, in declaration order. */
export const translatableFieldNamesOf = (app: App, tableName: string): readonly string[] =>
  (app.tables?.find((table) => table.name === tableName)?.fields ?? [])
    .filter(declaresTranslatable)
    .map((field) => field.name)

/**
 * Why a value cannot be written to a translatable field, or `undefined` when
 * it can. A string, `null` and an object of text (or `null`) by DECLARED
 * language code are accepted; a language the app does not declare — one never
 * declared, or one removed from `languages` — is refused, and so is any value
 * that is not text.
 *
 * @param declared - the app's declared language codes
 */
export const translatableWriteProblem = (
  value: unknown,
  declared: readonly string[]
): string | undefined => {
  if (value === null || value === undefined || typeof value === 'string') return undefined
  if (!isLanguageMapShape(value)) return 'takes text, or an object of text by language code'
  const undeclared = Object.keys(value).filter((code) => !declared.includes(code))
  if (undeclared.length > 0) {
    return `names a language the app does not declare: ${undeclared.join(', ')}`
  }
  const notText = Object.entries(value)
    .filter(([, text]) => text !== null && typeof text !== 'string')
    .map(([code]) => code)
  return notText.length === 0
    ? undefined
    : `takes text or null for each language, not for: ${notText.join(', ')}`
}

/** Whether a written language value is text to keep, rather than a removal. */
const kept = (text: unknown): text is string => typeof text === 'string' && text !== ''

/**
 * A written value as the merge it writes: a string is the value of
 * `language`, an object keeps its entries, and an empty string or `null`
 * removes its language. `undefined` for a value that names no language at all
 * (`null` itself, which clears the whole field).
 */
export const toLanguageMerge = (value: unknown, language: string): LanguageMerge | undefined => {
  const entries =
    typeof value === 'string'
      ? [[language, value] as const]
      : isLanguageMapShape(value)
        ? Object.entries(value)
        : undefined
  if (entries === undefined) return undefined
  return {
    [LANGUAGE_MERGE]: true,
    set: Object.fromEntries(
      entries.flatMap(([code, text]) => (kept(text) ? [[code, text] as const] : []))
    ),
    remove: entries.filter(([, text]) => !kept(text)).map(([code]) => code),
  }
}

/**
 * Whether a write leaves a REQUIRED translatable field without its
 * default-language value, which is what `required` asks for. A create must
 * name it; an update may leave it out (the record already holds it), but may
 * not remove it — nor clear the whole field.
 *
 * @param merge - the merge the write makes, `undefined` when it clears the field
 */
export const leavesDefaultLanguageEmpty = (
  merge: LanguageMerge | undefined,
  defaultLanguage: string,
  write: 'create' | 'update'
): boolean =>
  merge === undefined ||
  (write === 'create'
    ? !Object.hasOwn(merge.set, defaultLanguage)
    : merge.remove.includes(defaultLanguage))

/**
 * A row as an import names its languages, folded into one value per field: a
 * column `name.fr` is the French value of `name`, and a plain `name` column the
 * default language's. A suffix on a field that is not translatable is left as
 * the column it is, for the import to refuse as any unknown column.
 *
 * @param names - the table's translatable fields
 */
export const foldLanguageColumns = (
  fields: Readonly<Record<string, unknown>>,
  names: readonly string[],
  defaultLanguage: string
): Readonly<Record<string, unknown>> => {
  const suffixed = (key: string): readonly [string, string] | undefined => {
    const dot = key.indexOf('.')
    const name = key.slice(0, dot)
    return dot > 0 && names.includes(name) ? [name, key.slice(dot + 1)] : undefined
  }
  const languageColumns = Object.keys(fields).filter((key) => suffixed(key) !== undefined)
  if (languageColumns.length === 0) return fields
  const kept = Object.fromEntries(
    Object.entries(fields).filter(([key]) => suffixed(key) === undefined)
  )
  const folded = languageColumns.reduce<Readonly<Record<string, unknown>>>((acc, key) => {
    const [name, code] = suffixed(key) ?? ['', '']
    const base = acc[name]
    const map = typeof base === 'string' ? { [defaultLanguage]: base } : base
    return { ...acc, [name]: { ...(isLanguageMapShape(map) ? map : {}), [code]: fields[key] } }
  }, kept)
  return folded
}

/** Whether a written value is a {@link LanguageMerge}. */
export const isLanguageMerge = (value: unknown): value is LanguageMerge =>
  typeof value === 'object' &&
  value !== null &&
  (value as { readonly [LANGUAGE_MERGE]?: unknown })[LANGUAGE_MERGE] === true

/**
 * `fields` with every translatable value as the {@link LanguageMerge} it
 * writes. A plain string still here is the default language's: the records
 * API has already filed the writer's own strings under their language, so the
 * strings left come from a writer with no language — an automation, a seed, a
 * tool. `null` clears the field, and is kept as it is.
 */
export const languageMergesIn = (
  app: App | undefined,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  if (app?.languages === undefined) return fields
  const [defaultLanguage = ''] = recordLanguageOrder(app.languages)
  const merges = translatableFieldNamesOf(app, tableName).flatMap((name) => {
    const merge = isLanguageMerge(fields[name])
      ? undefined
      : toLanguageMerge(fields[name], defaultLanguage)
    return merge === undefined ? [] : [[name, merge] as const]
  })
  return merges.length === 0 ? fields : { ...fields, ...Object.fromEntries(merges) }
}

/**
 * `fields` with every plain string written to a translatable field filed
 * under `language` — the language its writer answered in (a public form, in
 * the page's language). An object already names its languages and is kept.
 * Without a language, the strings stay for {@link languageMergesIn} to file
 * under the default language.
 */
export const inWriteLanguage = (
  app: App,
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  language: string | undefined
): Readonly<Record<string, unknown>> => {
  if (language === undefined) return fields
  const filed = translatableFieldNamesOf(app, tableName).flatMap((name) => {
    const value = fields[name]
    return typeof value === 'string' ? [[name, { [language]: value }] as const] : []
  })
  return filed.length === 0 ? fields : { ...fields, ...Object.fromEntries(filed) }
}
