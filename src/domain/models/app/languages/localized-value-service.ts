/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseAcceptLanguage } from '@/domain/kernel/url/accept-language-parser'
import { findDeclaredLanguageCode } from './language-detection'
import { normalizeLanguageCode } from './translation-resolver'
import type { Languages } from './language'

/**
 * Reading translatable record content in one language.
 *
 * A translatable field stores a map from language code to text. A reader asks
 * for one language, and gets one string: the value in that language, else in
 * `languages.fallback`, else in `languages.default` — the same order a `$t:`
 * key falls back in, so a page never shows its chrome in one language and its
 * content's fallback in another. A reader asking for every language (`*`) gets
 * the map itself.
 *
 * A language the app no longer declares keeps its values in storage, but is
 * never served: not as the active language, not in the chain, not under `*`.
 *
 * The map's shape is the one `tables/translatable-field-service.ts` writes; it
 * is restated here in two lines because the `languages` slug reads no other.
 */

/** The language a reader asks for to receive every language's value: the whole map. */
export const ALL_LANGUAGES = '*'

/** A language map: language code to text. */
export type LanguageMap = Readonly<Record<string, string>>

/** Whether `value` is a plain object (not null, not an array). */
const isMapShape = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The language codes the app declares, the default first. */
const declaredCodes = (languages: Languages | undefined): readonly string[] =>
  languages === undefined
    ? []
    : [
        languages.default,
        ...languages.supported
          .map((language) => language.code)
          .filter((code) => code !== languages.default),
      ]

/** `value` with only the declared languages that hold a non-empty string. */
export const servedLanguageMap = (
  map: Readonly<Record<string, unknown>>,
  languages: Languages | undefined
): LanguageMap | undefined => {
  const declared = declaredCodes(languages)
  const entries = Object.entries(map).flatMap(([code, text]) =>
    declared.includes(code) && typeof text === 'string' && text !== ''
      ? [[code, text] as const]
      : []
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * The one string a language map reads as in `lang`: the value in `lang`, else
 * in `languages.fallback`, else in `languages.default`, else the first declared
 * language that holds one. `lang` may be a code (`fr`) or a regional spelling
 * (`fr-FR`), matched as `$t:` keys are matched. Only declared languages are
 * read. `undefined` when the map holds no declared value.
 *
 * @example
 * resolveLocalized({ en: 'Linen shirt', fr: 'Chemise en lin' }, 'fr', languages) // 'Chemise en lin'
 * resolveLocalized({ en: 'Linen scarf' }, 'de', languages) // 'Linen scarf' (default)
 */
export const resolveLocalized = (
  map: Readonly<Record<string, unknown>>,
  lang: string | undefined,
  languages: Languages | undefined
): string | undefined => {
  const served = servedLanguageMap(map, languages)
  if (served === undefined) return undefined
  const chain = [lang, languages?.fallback, languages?.default].flatMap((code) =>
    code === undefined || code === '' ? [] : [normalizeLanguageCode(code, served)]
  )
  const code = [...chain, ...declaredCodes(languages)].find((candidate) => candidate in served)
  return code === undefined ? undefined : served[code]
}

/**
 * A translatable field's stored cell as its map. PostgreSQL hands back the
 * `jsonb` object; SQLite the JSON text, parsed here. A plain string that is not
 * a JSON map is the default-language value (a value written before the field
 * was translatable). `undefined` for no value.
 */
export const storedLanguageMap = (
  value: unknown,
  languages: Languages | undefined
): Readonly<Record<string, unknown>> | undefined => {
  if (isMapShape(value)) return value
  if (typeof value !== 'string' || value === '') return undefined
  const parsed = parseJsonObject(value)
  if (parsed !== undefined) return parsed
  return languages === undefined ? undefined : { [languages.default]: value }
}

/** `text` parsed as a JSON object, or `undefined` when it is not one. */
const parseJsonObject = (text: string): Readonly<Record<string, unknown>> | undefined => {
  if (!text.trimStart().startsWith('{')) return undefined
  try {
    const parsed: unknown = JSON.parse(text)
    return isMapShape(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * A translatable field's stored cell as a reader receives it in `lang`: one
 * string ({@link resolveLocalized}), or under {@link ALL_LANGUAGES} the map of
 * the declared languages. `undefined` when there is nothing to serve.
 */
export const localizeStoredValue = (
  value: unknown,
  lang: string,
  languages: Languages | undefined
): string | LanguageMap | undefined => {
  const map = storedLanguageMap(value, languages)
  if (map === undefined) return undefined
  return lang === ALL_LANGUAGES
    ? servedLanguageMap(map, languages)
    : resolveLocalized(map, lang, languages)
}

/**
 * A cell holding translatable content as its reader receives it in `lang`:
 * {@link localizeStoredValue}, applied to each value of a list (a lookup
 * through a to-many link copies one map per linked record).
 */
export const localizeStoredCell = (
  value: unknown,
  lang: string,
  languages: Languages | undefined
): string | LanguageMap | undefined | readonly (string | LanguageMap | undefined)[] =>
  Array.isArray(value)
    ? value.map((item: unknown) => localizeStoredValue(item, lang, languages))
    : localizeStoredValue(value, lang, languages)

/** The declared code a language tag names: by code or locale, else by its base language. */
const declaredCodeOf = (
  languages: Languages | undefined,
  tag: string | undefined
): string | undefined => {
  if (languages === undefined || tag === undefined || tag === '') return undefined
  const base = tag.split('-')[0]
  return (
    findDeclaredLanguageCode(languages, tag) ??
    findDeclaredLanguageCode(languages, base) ??
    languages.supported.find((language) => language.code.split('-')[0] === base)?.code
  )
}

/**
 * The language a records read is served in: `?lang=` when it names a declared
 * language (or is `*`), else the first declared language `Accept-Language`
 * names, in the header's order of preference, else `languages.default`. An
 * undeclared `?lang=` is ignored, read as if absent.
 *
 * @param lang - the `lang` query parameter, as received
 * @param acceptLanguage - the `Accept-Language` header, as received
 * @returns a declared code, {@link ALL_LANGUAGES}, or `undefined` when the app declares no languages
 */
export const requestedRecordLanguage = (
  languages: Languages | undefined,
  lang: string | undefined,
  acceptLanguage: string | undefined
): string | undefined => {
  if (languages === undefined) return undefined
  if (lang === ALL_LANGUAGES) return ALL_LANGUAGES
  return (
    declaredCodeOf(languages, lang) ??
    parseAcceptLanguage(acceptLanguage)
      .map((tag) => declaredCodeOf(languages, tag))
      .find((code) => code !== undefined) ??
    languages.default
  )
}
