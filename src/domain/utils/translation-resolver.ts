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

const INTERPRETER_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'datatable.newRecord': {
    en: 'New record',
    fr: 'Nouvel enregistrement',
  },
}

const DEFAULT_INTERPRETER_LANG = 'en'

export function resolveInterpreterString(
  key: string,
  currentLang: string | undefined,
  languages?: Languages
): string {
  const lang = currentLang ?? DEFAULT_INTERPRETER_LANG

  const authored = resolveTranslation(key, lang, languages)
  if (authored !== key) {
    return authored
  }

  const catalog = INTERPRETER_UI_STRINGS[key]
  if (!catalog) {
    return key
  }
  const baseLang = lang.split('-')[0] ?? lang
  return catalog[lang] ?? catalog[baseLang] ?? catalog[DEFAULT_INTERPRETER_LANG] ?? key
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
