/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  DEFAULT_INTERPRETER_LANG,
  ENGINE_KEY_PREFIX,
  INTERPRETER_UI_STRINGS,
  LEGACY_BARE_ENGINE_KEYS,
} from './interpreter-ui-strings'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Normalize language code to match translation keys
 *
 * Tries exact match first, then falls back to base language code (e.g., 'fr-FR' → 'fr')
 *
 * @param lang - Language code (e.g., 'fr-FR', 'en-US', 'fr')
 * @param translations - Available translations object
 * @returns Matching translation key or original language code
 *
 * @example
 * ```typescript
 * normalizeLanguageCode('fr-FR', { fr: {...}, en: {...} }) // 'fr'
 * normalizeLanguageCode('fr', { fr: {...}, en: {...} })    // 'fr'
 * normalizeLanguageCode('en-US', { 'en-US': {...} })       // 'en-US'
 * ```
 */
export function normalizeLanguageCode(
  lang: string,
  translations: Readonly<Record<string, Record<string, string>>>
): string {
  // Try exact match first
  if (translations[lang]) {
    return lang
  }

  // Try base language code (e.g., 'fr-FR' → 'fr')
  const baseLang = lang.split('-')[0]
  if (baseLang && translations[baseLang]) {
    return baseLang
  }

  // No match found - return original
  return lang
}

/**
 * Resolve an INTERPRETER-provided UI string against the active language.
 *
 * Precedence (highest first):
 *   1. Author override in the ACTIVE language — `languages.translations[<lang>]['sovrium.<key>']`.
 *   2. Built-in catalog entry for the active language (exact, then base code).
 *   3. Author override in the fallback / default language.
 *   4. Built-in English default.
 *   5. The key itself (last resort — a key with no catalog entry).
 *
 * An author override is read under the reserved `sovrium.` prefix only: a bare
 * key is the author's own `$t:` vocabulary and never renames engine chrome. The
 * ten {@link LEGACY_BARE_ENGINE_KEYS} a release read bare are still read bare
 * when the prefixed spelling is absent in the same language.
 *
 * Unlike app content, an author string written for ANOTHER language does not
 * beat the built-in string for the page's own language: an English-only
 * `sovrium.datatable.columns: Fields` renames the English grid and leaves a
 * French page reading « Colonnes », rather than dropping English chrome onto it
 * — the defect this catalog exists to remove.
 *
 * @param key - Interpreter string key (e.g. `datatable.newRecord`)
 * @param currentLang - Active language code (e.g. `en-US`, `fr-FR`); defaults to English
 * @param languages - App languages configuration (author overrides)
 * @returns The resolved UI string
 */
export function resolveInterpreterString(
  key: string,
  currentLang: string | undefined,
  languages?: Languages
): string {
  const lang = currentLang ?? DEFAULT_INTERPRETER_LANG
  return (
    authoredInLanguage(key, lang, languages) ??
    builtInInLanguage(key, lang) ??
    authoredInFallbackLanguage(key, lang, languages) ??
    INTERPRETER_UI_STRINGS[key]?.[DEFAULT_INTERPRETER_LANG] ??
    key
  )
}

const LEGACY_BARE_KEYS: ReadonlySet<string> = new Set(LEGACY_BARE_ENGINE_KEYS)

/**
 * The author's override of an engine key in one language's dictionary: the
 * prefixed spelling, else — for a legacy key only — the bare one.
 */
const engineOverrideIn = (
  key: string,
  dictionary: Readonly<Record<string, string>> | undefined
): string | undefined => {
  if (dictionary === undefined) return undefined
  const prefixed = dictionary[`${ENGINE_KEY_PREFIX}${key}`]
  if (prefixed) return prefixed
  return LEGACY_BARE_KEYS.has(key) ? dictionary[key] || undefined : undefined
}

/** The author's string for exactly the active language (exact, then base code), if any. */
const authoredInLanguage = (
  key: string,
  lang: string,
  languages: Languages | undefined
): string | undefined => {
  const translations = languages?.translations
  if (translations === undefined) return undefined
  return engineOverrideIn(key, translations[normalizeLanguageCode(lang, translations)])
}

/** The author's string for the fallback (else default) language, when it is not the active one. */
const authoredInFallbackLanguage = (
  key: string,
  lang: string,
  languages: Languages | undefined
): string | undefined => {
  const translations = languages?.translations
  if (languages === undefined || translations === undefined) return undefined
  const fallback = normalizeLanguageCode(languages.fallback || languages.default, translations)
  if (fallback === normalizeLanguageCode(lang, translations)) return undefined
  return engineOverrideIn(key, translations[fallback])
}

/** The built-in catalog string for the active language (exact, then base code), if any. */
const builtInInLanguage = (key: string, lang: string): string | undefined => {
  const catalog = INTERPRETER_UI_STRINGS[key]
  if (catalog === undefined) return undefined
  return catalog[lang] ?? catalog[lang.split('-')[0] ?? lang]
}

/**
 * Resolve every interpreter string whose key starts with `prefix`, keeping only
 * those that DIFFER from the built-in English default.
 *
 * This is the payload an island receives: each surface keeps its English
 * literal as the fallback, so an English app with no author overrides gets
 * `undefined` — nothing serialized, and a page byte-identical to one rendered
 * before the catalog grew — while a French page, or an author override in any
 * language, gets exactly the strings that change.
 *
 * @param prefixes - Key prefixes to include (e.g. `['datatable.']`)
 * @param currentLang - Active language code; defaults to English
 * @param languages - App languages configuration (author overrides)
 * @returns The differing strings keyed by catalog key, or `undefined` when none differ
 */
export function resolveInterpreterStringOverrides(
  prefixes: readonly string[],
  currentLang: string | undefined,
  languages?: Languages
): Readonly<Record<string, string>> | undefined {
  const entries = Object.entries(INTERPRETER_UI_STRINGS).flatMap(([key, catalog]) => {
    if (!prefixes.some((prefix) => key.startsWith(prefix))) return []
    const resolved = resolveInterpreterString(key, currentLang, languages)
    return resolved === catalog[DEFAULT_INTERPRETER_LANG] ? [] : [[key, resolved] as const]
  })
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/**
 * Resolve translation key with fallback support
 *
 * Implements the $t:key pattern for centralized translations.
 * When a translation is missing in the current language, falls back to the fallback language.
 *
 * @param key - Translation key (e.g., 'welcome', 'common.save')
 * @param currentLang - Current language code (e.g., 'fr-FR')
 * @param languages - Languages configuration from app schema
 * @returns Translated string or key if not found
 *
 * @example
 * ```typescript
 * const text = resolveTranslation('welcome', 'fr-FR', languages)
 * // Returns: 'Bienvenue' if exists in fr-FR
 * // Returns: 'Welcome' if missing in fr-FR but exists in fallback en-US
 * // Returns: 'welcome' if not found in any language
 * ```
 */
export function resolveTranslation(
  key: string,
  currentLang: string,
  languages?: Languages
): string {
  // No translations configured - return key as-is
  if (!languages?.translations) {
    return key
  }

  const { translations, fallback } = languages

  // Normalize language code to match translation keys (e.g., 'fr-FR' → 'fr')
  const normalizedLang = normalizeLanguageCode(currentLang, translations)

  // Try current language first
  const currentTranslations = translations[normalizedLang]
  if (currentTranslations?.[key]) {
    return currentTranslations[key]
  }

  // Try fallback language (defaults to default language)
  const fallbackLang = fallback || languages.default
  if (fallbackLang !== normalizedLang) {
    const normalizedFallback = normalizeLanguageCode(fallbackLang, translations)
    const fallbackTranslations = translations[normalizedFallback]
    if (fallbackTranslations?.[key]) {
      return fallbackTranslations[key]
    }
  }

  // Translation not found - return key
  return key
}

/**
 * The shape of a translation key, as a regular-expression source: letters,
 * digits, `_`, `-` and inner `.`.
 *
 * A key never ends with a `.`, so sentence punctuation after it is kept as
 * text rather than swallowed into the key. The ONE definition of the key
 * grammar: the leading-key split below and the markdown body pre-pass both
 * build their pattern from it.
 */
export const TRANSLATION_KEY_PATTERN_SOURCE = '[a-zA-Z0-9_-](?:[a-zA-Z0-9_.-]*[a-zA-Z0-9_-])?'

/** The key a `$t:` value opens with. */
const LEADING_TRANSLATION_KEY = new RegExp(`^\\$t:(${TRANSLATION_KEY_PATTERN_SOURCE})`)

/**
 * Split a value opening with `$t:` into its key and the text written after it.
 *
 * `'$t:portal.hello[, $session.name]'` is the key `portal.hello` followed by
 * `[, $session.name]`, which later passes (`$session.*`, optional segments)
 * resolve as written. Returns `undefined` for a value that does not open with
 * a key.
 */
export function splitLeadingTranslationKey(
  text: string
): { readonly key: string; readonly rest: string } | undefined {
  const match = LEADING_TRANSLATION_KEY.exec(text)
  const key = match?.[1]
  if (match === null || key === undefined) return undefined
  return { key, rest: text.slice(match[0].length) }
}

/**
 * Resolve the `$t:key` a string opens with, keeping whatever follows the key.
 *
 * The key ends at the first character a key cannot hold, so a value can carry
 * text and tokens after it. A value starting with `$t:` but holding no key
 * shape is resolved whole, as it always was.
 *
 * @param text - String that may open with a $t:key pattern
 * @param currentLang - Current language code
 * @param languages - Languages configuration from app schema
 * @returns String with the leading translation resolved
 *
 * @example
 * ```typescript
 * resolveTranslationPattern('$t:welcome', 'fr-FR', languages) // 'Bienvenue'
 * resolveTranslationPattern('$t:hello[, $session.name]', 'fr-FR', languages) // 'Bonjour[, $session.name]'
 * resolveTranslationPattern('$t:goodbye', 'fr-FR', languages) // 'Goodbye' (fallback)
 * resolveTranslationPattern('Hello world', 'fr-FR', languages) // 'Hello world' (no pattern)
 * ```
 */
export function resolveTranslationPattern(
  text: string,
  currentLang: string,
  languages?: Languages
): string {
  if (!text.startsWith('$t:')) return text
  const split = splitLeadingTranslationKey(text)
  if (split === undefined) return resolveTranslation(text.slice(3), currentLang, languages)
  return `${resolveTranslation(split.key, currentLang, languages)}${split.rest}`
}

/**
 * Recursively apply a string transform to every string in a value
 * (strings, arrays, plain objects). Non-string leaves pass through untouched.
 *
 * Shared deep-walk scaffold: the app-level token replacer
 * (`translation-replacer.ts`) and the island prop-payload resolver
 * (`resolveTranslationTokensDeep`) both map strings over arbitrary config
 * shapes — this keeps the recursion in one place.
 */
export function mapStringsDeep(value: unknown, transform: (str: string) => string): unknown {
  if (typeof value === 'string') {
    return transform(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapStringsDeep(item, transform))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, mapStringsDeep(val, transform)])
    )
  }

  return value
}

/**
 * Resolve `$t:key` tokens throughout an arbitrary value (deeply).
 *
 * Island SSR hosts serialize SCHEMA-level component fields (`triggerLabel`,
 * `menuItems`, `navItems`, ...) into `data-island-props`; those fields can
 * carry `$t:` tokens just like `content`/`props` do, so they must be resolved
 * against the active language BEFORE serialization — otherwise hydration
 * "un-translates" the SSR output back to raw tokens.
 *
 * Returns the value unchanged when there is no language context (no
 * translations configured or no current language).
 *
 * @example
 * ```typescript
 * resolveTranslationTokensDeep(
 *   { triggerLabel: '$t:nav.account', menuItems: [{ label: '$t:nav.profile' }] },
 *   'fr-FR',
 *   languages
 * )
 * // { triggerLabel: 'Compte', menuItems: [{ label: 'Voir le profil' }] }
 * ```
 */
export function resolveTranslationTokensDeep(
  value: unknown,
  currentLang: string | undefined,
  languages?: Languages
): unknown {
  if (!languages?.translations || !currentLang) {
    return value
  }
  return mapStringsDeep(value, (str) => resolveTranslationPattern(str, currentLang, languages))
}

/**
 * Collect all available translations for a key across all languages
 *
 * Used for pre-resolving translations on the server side, allowing client-side
 * code to simply lookup translations without re-implementing fallback logic.
 *
 * @param key - Translation key (e.g., 'welcome', 'common.save')
 * @param languages - Languages configuration from app schema
 * @returns Object mapping language codes to translated strings, or undefined if no translations
 *
 * @example
 * ```typescript
 * collectTranslationsForKey('welcome', languages)
 * // Returns: { 'en-US': 'Welcome', 'fr-FR': 'Bienvenue', 'es-ES': 'Bienvenido' }
 * ```
 */
export function collectTranslationsForKey(
  key: string,
  languages?: Languages
): Readonly<Record<string, string>> | undefined {
  if (!languages?.translations) {
    return undefined
  }

  // Collect translation for this key from all available languages (functional approach)
  const result = Object.entries(languages.translations).reduce(
    (acc, [lang, translations]) => {
      const translationDict = translations as Record<string, string>
      if (translationDict[key]) {
        return { ...acc, [lang]: translationDict[key] }
      }
      return acc
    },
    {} as Record<string, string>
  )

  // Return undefined if no translations found (key doesn't exist in any language)
  return Object.keys(result).length > 0 ? result : undefined
}
