/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App, Page } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages'
import type { LanguageConfig } from '@/domain/models/app/language/language-config'
import { resolveTranslation } from '@/presentation/translations/translation-resolver'

/**
 * Context for token replacement operations
 */
type TokenReplacementContext = {
  readonly langCode: string
  readonly langConfig: LanguageConfig
  readonly languages: Languages | undefined
  readonly translations: Record<string, string>
}

/**
 * Replace translation tokens in a string
 *
 * Replaces $t:key patterns with translations from the centralized translations dictionary.
 * Uses the same resolution logic as dynamic rendering (with fallback support).
 *
 * @param str - String potentially containing $t:key patterns
 * @param context - Token replacement context
 * @returns String with all $t: patterns resolved to translations
 *
 * @example
 * ```typescript
 * replaceTokens('$t:welcome', context)  // 'Welcome' (or 'Bienvenue' for fr)
 * replaceTokens('$t:goodbye', context)  // Falls back to default if missing
 * replaceTokens('Hello world', context) // 'Hello world' (no pattern)
 * ```
 */
function replaceTokens(str: string, context: TokenReplacementContext): string {
  // Check if string contains $t: pattern
  if (str.startsWith('$t:')) {
    const key = str.slice(3) // Remove '$t:' prefix
    return resolveTranslation(key, context.langCode, context.languages)
  }

  // No translation pattern found - return string as-is
  return str
}

/**
 * Replace tokens in any value (recursively handles objects, arrays, strings)
 */
function replaceTokensInValue(value: unknown, context: TokenReplacementContext): unknown {
  if (typeof value === 'string') {
    return replaceTokens(value, context)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensInValue(item, context))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, replaceTokensInValue(val, context)])
    )
  }

  return value
}

/**
 * Replace translation tokens in page meta and set lang attribute programmatically
 *
 * Sets meta.lang to the full locale (e.g., 'en-US', 'fr-FR') without using tokens.
 * Then resolves any $t: patterns in the remaining meta fields.
 */
function replaceMetaTokens(meta: Page['meta'], context: TokenReplacementContext): Page['meta'] {
  if (!meta) return meta

  // Set lang to full locale programmatically (not via token)
  const locale = context.langConfig.locale || context.langCode
  const metaWithLang = {
    ...meta,
    lang: locale,
  }

  // Resolve $t: patterns in remaining meta fields
  return replaceTokensInValue(metaWithLang, context) as Page['meta']
}

/**
 * Replace translation tokens in a page configuration
 *
 * Resolves $t:key patterns throughout the page and sets meta.lang programmatically.
 *
 * @param page - Page with potential $t:key translation tokens
 * @param langCode - Language code (e.g., 'en', 'fr')
 * @param langConfig - Language configuration object
 * @param languages - Full languages configuration (for fallback resolution)
 * @param translations - Translations for the language
 * @returns Page with all $t: patterns resolved
 */
export function replacePageTokens(
  page: Page,
  langCode: string,
  langConfig: LanguageConfig,
  languages: Languages | undefined,
  translations: Record<string, string>
): Page {
  const context: TokenReplacementContext = {
    langCode,
    langConfig,
    languages,
    translations,
  }

  // Replace tokens in everything except meta
  const { meta, ...restOfPage } = page
  const replacedRest = replaceTokensInValue(restOfPage, context) as Omit<Page, 'meta'>

  // Replace meta separately with special lang handling
  const replacedMeta = replaceMetaTokens(meta, context)

  return {
    ...replacedRest,
    meta: replacedMeta,
  } as Page
}

/**
 * Replace translation tokens in app configuration for a specific language
 *
 * Resolves all $t:key patterns throughout the app for static site generation.
 * This is a pure function that performs token replacement without throwing exceptions.
 * Callers should validate language codes before calling this function.
 *
 * @param app - App configuration (may contain $t:key tokens in pages)
 * @param langCode - Language code to generate for (e.g., 'en', 'fr')
 * @returns App with all $t: patterns resolved for the language
 * @internal This function assumes langCode exists in supported languages
 */
export function replaceAppTokens(app: App, langCode: string): App {
  // If no languages configured, return app as-is
  if (!app.languages) {
    return app
  }

  // Find language config - caller must ensure langCode is valid
  const langConfig = app.languages.supported.find((lang) => lang.code === langCode)!

  // Get translations for this language
  const translations = app.languages.translations?.[langCode] || {}

  // Replace tokens in pages
  const pages = app.pages?.map((page) =>
    replacePageTokens(page, langCode, langConfig, app.languages, translations)
  )

  // Return app with replaced pages
  return {
    ...app,
    pages,
  }
}
