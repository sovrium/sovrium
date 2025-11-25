/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveChildTranslation } from './translation-handler'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Builds i18n content data attribute for client-side language switching (functional approach)
 *
 * Extracts content translations from i18n object and serializes to JSON.
 * Includes default language content as fallback.
 *
 * @param i18n - Component i18n translations object
 * @param defaultContent - Default content for base language
 * @param defaultLang - Default language code
 * @returns JSON-stringified i18n content data or undefined if no translations
 */
function buildI18nContentAttribute(
  i18n: Record<string, unknown>,
  defaultContent: string,
  defaultLang: string | undefined
): string | undefined {
  // Extract content from i18n object using functional approach (reduce instead of for loop)
  const i18nContentData = Object.entries(i18n).reduce<Record<string, string>>(
    (acc, [lang, value]) => {
      if (typeof value === 'object' && value !== null && 'content' in value && value.content) {
        return { ...acc, [lang]: value.content as string }
      }
      return acc
    },
    {}
  )

  // Add default language content if not already present
  const contentWithDefault =
    defaultLang && !i18nContentData[defaultLang]
      ? { ...i18nContentData, [defaultLang]: defaultContent }
      : i18nContentData

  // Only return attribute if there are translations
  return Object.keys(contentWithDefault).length > 0 ? JSON.stringify(contentWithDefault) : undefined
}

/**
 * Resolves component content with i18n priority
 *
 * Priority: component.i18n[lang].content > $t: pattern > content
 *
 * @param content - Base content string
 * @param i18n - Component i18n translations
 * @param currentLang - Current language code
 * @param languages - Languages configuration
 * @returns Resolved content string
 */
function resolveComponentContent(
  content: string | Record<string, unknown> | undefined,
  i18n: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): string | undefined {
  // If content is an object (structured content like { button: {...} }), return undefined
  // The component renderer will handle structured content directly
  if (content && typeof content === 'object') {
    return undefined
  }

  if (i18n && currentLang) {
    const langData = i18n[currentLang]
    if (
      langData &&
      typeof langData === 'object' &&
      'content' in langData &&
      typeof langData.content === 'string'
    ) {
      return langData.content
    }
  }
  if (content) {
    return resolveChildTranslation(content, currentLang, languages)
  }
  return content
}

/**
 * Builds final element props with i18n data attribute
 *
 * @param baseProps - Base element props
 * @param i18nAttribute - Optional i18n content JSON string
 * @returns Element props with i18n data merged if present
 */
function buildFinalElementProps(
  baseProps: Record<string, unknown>,
  i18nAttribute: string | undefined
): Record<string, unknown> {
  return i18nAttribute ? { ...baseProps, 'data-i18n-content': i18nAttribute } : baseProps
}

/**
 * Resolves i18n content and builds element props with i18n data attribute
 *
 * @param content - Base content
 * @param i18n - Component i18n translations
 * @param currentLang - Current language code
 * @param languages - Languages configuration
 * @param elementProps - Base element props
 * @param elementPropsWithSpacing - Base element props with spacing
 * @returns Resolved content and element props with i18n data
 */
// eslint-disable-next-line max-params -- Extracted helper function maintains original logic
export function resolveI18nContent(
  content: string | Record<string, unknown> | undefined,
  i18n: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined,
  elementProps: Record<string, unknown>,
  elementPropsWithSpacing: Record<string, unknown>
): {
  readonly resolvedContent: string | undefined
  readonly finalElementProps: Record<string, unknown>
  readonly finalElementPropsWithSpacing: Record<string, unknown>
} {
  // Resolve content with i18n priority: component.i18n[lang].content > $t: pattern > content
  const resolvedContent = resolveComponentContent(content, i18n, currentLang, languages)

  // Build i18n content data attribute and merge into element props (functional approach)
  const i18nContentAttribute =
    i18n && content
      ? buildI18nContentAttribute(i18n, content as string, languages?.default)
      : undefined

  const finalElementProps = buildFinalElementProps(elementProps, i18nContentAttribute)
  const finalElementPropsWithSpacing = buildFinalElementProps(
    elementPropsWithSpacing,
    i18nContentAttribute
  )

  return {
    resolvedContent,
    finalElementProps,
    finalElementPropsWithSpacing,
  }
}
