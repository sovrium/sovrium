/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
  translations: Record<string, Record<string, string>>
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
 * Built-in catalog of INTERPRETER-provided UI strings — chrome Sovrium renders
 * itself (not app-author content). Keyed by translation key, then by 2-letter
 * language code. English is the platform default; French ships the string that
 * used to be hard-coded in the island source. Author `languages.translations`
 * entries override these (see {@link resolveInterpreterString}).
 *
 *.
 */
const INTERPRETER_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'datatable.newRecord': {
    en: 'New record',
    fr: 'Nouvel enregistrement',
  },
  /** Create-record dialog footer + inline editor commit (data-table island). */
  'datatable.save': {
    en: 'Save',
    fr: 'Enregistrer',
  },
  /** Create-record dialog footer, inline editor + confirm-gate dismissal. */
  'datatable.cancel': {
    en: 'Cancel',
    fr: 'Annuler',
  },
  /** Record-drawer default accessible name (when the author declares no title). */
  'recordDrawer.title': {
    en: 'Record details',
    fr: "Détail de l'enregistrement",
  },
  'recordDrawer.save': {
    en: 'Save',
    fr: 'Enregistrer',
  },
  /** Record-drawer close affordance — an icon button, so this IS its whole name. */
  'recordDrawer.close': {
    en: 'Close',
    fr: 'Fermer',
  },
}

/** Platform default language for interpreter strings when none is resolved. */
const DEFAULT_INTERPRETER_LANG = 'en'

/**
 * Resolve an INTERPRETER-provided UI string against the active language.
 *
 * Precedence (highest first):
 *   1. Author override — `languages.translations[<lang>][key]` (via {@link resolveTranslation}).
 *   2. Built-in catalog entry for the active language (exact, then base code).
 *   3. Built-in English default.
 *   4. The key itself (last resort — a key with no catalog entry).
 *
 * This lets an app show interpreter chrome in its own language (English by
 * default, French built-in) and still override any string via centralized
 * translations — the same rule that governs app content.
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

  // 1. Author override wins — resolveTranslation returns the key unchanged when
  //    no author translation matches.
  const authored = resolveTranslation(key, lang, languages)
  if (authored !== key) {
    return authored
  }

  // 2/3. Built-in catalog: exact language, then base code, then English default.
  const catalog = INTERPRETER_UI_STRINGS[key]
  if (!catalog) {
    return key
  }
  const baseLang = lang.split('-')[0] ?? lang
  return catalog[lang] ?? catalog[baseLang] ?? catalog[DEFAULT_INTERPRETER_LANG] ?? key
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
 * Resolve $t:key pattern in a string
 *
 * Processes strings containing $t:key syntax and replaces them with translations.
 * Supports fallback when translation is missing.
 *
 * @param text - String that may contain $t:key patterns
 * @param currentLang - Current language code
 * @param languages - Languages configuration from app schema
 * @returns String with resolved translations
 *
 * @example
 * ```typescript
 * resolveTranslationPattern('$t:welcome', 'fr-FR', languages) // 'Bienvenue'
 * resolveTranslationPattern('$t:goodbye', 'fr-FR', languages) // 'Goodbye' (fallback)
 * resolveTranslationPattern('Hello world', 'fr-FR', languages) // 'Hello world' (no pattern)
 * ```
 */
export function resolveTranslationPattern(
  text: string,
  currentLang: string,
  languages?: Languages
): string {
  // Check if text starts with $t: pattern
  if (text.startsWith('$t:')) {
    const key = text.slice(3) // Remove '$t:' prefix
    return resolveTranslation(key, currentLang, languages)
  }

  // No pattern found - return text as-is
  return text
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
): Record<string, string> | undefined {
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
