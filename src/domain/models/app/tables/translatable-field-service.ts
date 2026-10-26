/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Translatable fields — `translatable: true` on a `single-line-text` or
 * `long-text` field: one value per declared language, held in the field's own
 * column as a map from language code to text (`{ "en": "…", "fr": "…" }`).
 *
 * What is here is the shape of that map, independent of any engine: which
 * fields carry one, the order the app's languages are tried in, how a plain
 * string becomes a map, and how a map becomes one string again when the option
 * is turned off.
 */

/** The two field types that may carry `translatable: true`. */
export const TRANSLATABLE_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
])

/** A language map: language code to text. */
export type LanguageMap = Readonly<Record<string, string>>

/** Whether a declared field carries `translatable: true` on a type that takes it. */
export const declaresTranslatable = (field: object): boolean =>
  'translatable' in field &&
  (field as { readonly translatable?: unknown }).translatable === true &&
  TRANSLATABLE_FIELD_TYPES.has(String((field as { readonly type?: unknown }).type))

/** The slice of `app.languages` the record-content rules read. */
export interface RecordLanguages {
  readonly default: string
  readonly supported: ReadonlyArray<{ readonly code: string }>
}

/**
 * The declared language codes in the order a value is looked for: the default
 * language first, then the others as `supported` lists them. Empty when the
 * app declares no languages.
 */
export const recordLanguageOrder = (languages: RecordLanguages | undefined): readonly string[] =>
  languages === undefined
    ? []
    : [
        languages.default,
        ...languages.supported
          .map((language) => language.code)
          .filter((code) => code !== languages.default),
      ]

/** Whether `value` is a plain object (not null, not an array). */
export const isLanguageMapShape = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A value as the map a translatable field stores: a string is the value of
 * `defaultLanguage`, a map keeps its entries. An empty string is no value, so
 * it is dropped, and a value with no entry left is `undefined`.
 */
export const toLanguageMap = (value: unknown, defaultLanguage: string): LanguageMap | undefined => {
  const entries =
    typeof value === 'string'
      ? [[defaultLanguage, value] as const]
      : isLanguageMapShape(value)
        ? Object.entries(value).flatMap(([code, text]) =>
            typeof text === 'string' ? [[code, text] as const] : []
          )
        : []
  const kept = entries.filter(([, text]) => text !== '')
  return kept.length === 0 ? undefined : Object.fromEntries(kept)
}

/**
 * The one string a map collapses to when the field stops being translatable:
 * the first non-empty value in `order` (the default language first), else the
 * first non-empty value the map holds at all. `undefined` when it holds none.
 */
export const collapseLanguageMap = (
  map: Readonly<Record<string, unknown>>,
  order: readonly string[]
): string | undefined => {
  const present = (code: string): string | undefined => {
    const text = map[code]
    return typeof text === 'string' && text !== '' ? text : undefined
  }
  const ordered = order.map(present).find((text) => text !== undefined)
  return (
    ordered ??
    Object.keys(map)
      .map(present)
      .find((text) => text !== undefined)
  )
}

/**
 * The keys of a map value that are not declared languages, in the order they
 * appear. A value that is not a map has none.
 */
export const undeclaredLanguageKeys = (
  value: unknown,
  declared: readonly string[]
): readonly string[] =>
  isLanguageMapShape(value) ? Object.keys(value).filter((code) => !declared.includes(code)) : []

/** The slice of a table the collapse refusal reads. */
interface CollapseTable {
  readonly name: string
  readonly allowDestructive?: boolean | undefined
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

/**
 * The refusal of a change turning `translatable` OFF on a field without
 * `allowDestructive`: the collapse keeps one value per record and drops the
 * others, so it needs the table's consent. `undefined` when there is none to
 * refuse.
 *
 * @param previous - the table as the last migration recorded it
 */
export const translatableCollapseRefusal = (
  table: CollapseTable,
  previous: { readonly fields?: readonly object[] } | undefined
): string | undefined => {
  if (table.allowDestructive === true) return undefined
  const wasTranslatable = new Set(
    (previous?.fields ?? [])
      .filter(declaresTranslatable)
      .map((field) => String((field as { readonly name?: unknown }).name))
  )
  const collapsed = table.fields
    .filter((field) => TRANSLATABLE_FIELD_TYPES.has(field.type) && !declaresTranslatable(field))
    .map((field) => field.name)
    .filter((name) => wasTranslatable.has(name))
  return collapsed.length === 0
    ? undefined
    : `Destructive operation detected: turning off translatable on field(s) [${collapsed.join(', ')}] of table '${table.name}' keeps one value per record (the default language's, else the first one present) and drops every other language. Set allowDestructive: true to proceed, or keep translatable: true.`
}
