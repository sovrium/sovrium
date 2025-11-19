/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  collectTranslationsForKey,
  resolveTranslationPattern,
} from '@/presentation/translations/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Find first translation key in children
 */
export function findFirstTranslationKey(
  children: readonly (Component | string)[] | undefined
): string | undefined {
  return children
    ?.find(
      (child: Component | string): child is string =>
        typeof child === 'string' && child.startsWith('$t:')
    )
    ?.slice(3) // Remove '$t:' prefix
}

/**
 * Get current language with fallback
 */
export function getCurrentLanguage(
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  return currentLang || languages?.default || 'en-US'
}

/**
 * Resolve translation pattern for a child element
 */
export function resolveChildTranslation(
  child: string,
  currentLang: string | undefined,
  languages: Languages | undefined
): string {
  const lang = getCurrentLanguage(currentLang, languages)
  return resolveTranslationPattern(child, lang, languages)
}

/**
 * Collect translation data for a key
 */
export function getTranslationData(
  translationKey: string | undefined,
  languages: Languages | undefined
): Record<string, string> | undefined {
  return translationKey ? collectTranslationsForKey(translationKey, languages) : undefined
}

/**
 * Substitutes translation tokens in props recursively
 *
 * Walks through props object and replaces all $t:key patterns with actual translations.
 * Handles nested objects (e.g., style props) recursively.
 *
 * @param props - Component props that may contain translation tokens
 * @param currentLang - Current language code
 * @param languages - Languages configuration
 * @returns Props with translation tokens replaced
 *
 * @example
 * ```typescript
 * const languages = {
 *   default: 'en',
 *   translations: { 'en': { 'close.label': 'Close dialog' } }
 * }
 * const props = {
 *   'aria-label': '$t:close.label',
 *   title: 'Static text'
 * }
 * substitutePropsTranslationTokens(props, 'en-US', languages)
 * // {
 * //   'aria-label': 'Close dialog',
 * //   title: 'Static text'
 * // }
 * ```
 */
export function substitutePropsTranslationTokens(
  props: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): Record<string, unknown> | undefined {
  if (!props || !languages) {
    return props
  }

  const lang = getCurrentLanguage(currentLang, languages)

  // Use functional Object.entries + reduce for immutable transformation
  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      return { ...acc, [key]: resolveTranslationPattern(value, lang, languages) }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively handle nested objects (like style props)
      return {
        ...acc,
        [key]: substitutePropsTranslationTokens(
          value as Record<string, unknown>,
          currentLang,
          languages
        ),
      }
    } else {
      return { ...acc, [key]: value }
    }
  }, {})
}
