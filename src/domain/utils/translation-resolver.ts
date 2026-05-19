/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Languages } from '@/domain/models/app/languages'

export function normalizeLanguageCode(
  lang: string,
  translations: Record<string, Record<string, string>>
): string {
  if (translations[lang]) {
    return lang
  }

  const baseLang = lang.split('-')[0]
  if (baseLang && translations[baseLang]) {
    return baseLang
  }

  return lang
}

export function resolveTranslation(
  key: string,
  currentLang: string,
  languages?: Languages
): string {
  if (!languages?.translations) {
    return key
  }

  const { translations, fallback } = languages

  const normalizedLang = normalizeLanguageCode(currentLang, translations)

  const currentTranslations = translations[normalizedLang]
  if (currentTranslations?.[key]) {
    return currentTranslations[key]
  }

  const fallbackLang = fallback || languages.default
  if (fallbackLang !== normalizedLang) {
    const normalizedFallback = normalizeLanguageCode(fallbackLang, translations)
    const fallbackTranslations = translations[normalizedFallback]
    if (fallbackTranslations?.[key]) {
      return fallbackTranslations[key]
    }
  }

  return key
}

export function resolveTranslationPattern(
  text: string,
  currentLang: string,
  languages?: Languages
): string {
  if (text.startsWith('$t:')) {
    const key = text.slice(3)
    return resolveTranslation(key, currentLang, languages)
  }

  return text
}

export function collectTranslationsForKey(
  key: string,
  languages?: Languages
): Record<string, string> | undefined {
  if (!languages?.translations) {
    return undefined
  }

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

  return Object.keys(result).length > 0 ? result : undefined
}
