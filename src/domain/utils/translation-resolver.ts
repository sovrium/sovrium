/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
