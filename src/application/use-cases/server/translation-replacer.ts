/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslation } from '@/domain/utils/translation-resolver'
import type { App, Page } from '@/domain/models/app'
import type { LanguageConfig } from '@/domain/models/app/language/language-config'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Context for token replacement operations
 */
type TokenReplacementContext = {
  readonly langCode: string
  readonly langConfig: LanguageConfig
  readonly languages: Languages | undefined
  readonly translations: Record<string, string>
  readonly currentPath?: string // Optional current page path for {{currentPath}} replacement
}

/**
 * Replace translation tokens in a string
 *
 * Replaces $t:key patterns with translations from the centralized translations dictionary.
 * Also replaces {{currentPath}} with the current page path.
 * Uses the same resolution logic as dynamic rendering (with fallback support).
 *
 * @param str - String potentially containing $t:key or {{currentPath}} patterns
 * @param context - Token replacement context
 * @returns String with all patterns resolved
 *
 * @example
 * ```typescript
 * replaceTokens('$t:welcome', context)  // 'Welcome' (or 'Bienvenue' for fr)
 * replaceTokens('$t:goodbye', context)  // Falls back to default if missing
 * replaceTokens('/en{{currentPath}}', { ...context, currentPath: '/about' })  // '/en/about'
 * replaceTokens('Hello world', context) // 'Hello world' (no pattern)
 * ```
 */
function replaceTokens(str: string, context: TokenReplacementContext): string {
  // Replace $t: translation pattern
  const translatedStr = str.startsWith('$t:')
    ? resolveTranslation(str.slice(3), context.langCode, context.languages)
    : str

  // Replace {{currentPath}} pattern (for language switcher hrefs)
  const currentPath = context.currentPath || '/'
  return translatedStr.replace(/\{\{currentPath\}\}/g, currentPath)
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
 * Also replaces {{currentPath}} patterns in language switcher hrefs.
 *
 * @param page - Page with potential $t:key translation tokens
 * @param context - Token replacement context
 * @returns Page with all $t: patterns resolved
 */
export function replacePageTokens(page: Page, context: TokenReplacementContext): Page {
  const pageContext: TokenReplacementContext = {
    ...context,
    currentPath: page.path, // Pass current page path for {{currentPath}} replacement
  }

  // Replace tokens in everything except meta
  const { meta, ...restOfPage } = page
  const replacedRest = replaceTokensInValue(restOfPage, pageContext) as Omit<Page, 'meta'>

  // Replace meta separately with special lang handling
  const replacedMeta = replaceMetaTokens(meta, pageContext)

  return {
    ...replacedRest,
    meta: replacedMeta,
  } as Page
}

/**
 * Replace translation tokens ($t:key) in a value, preserving {{currentPath}} placeholders
 *
 * This is used for defaultLayout where {{currentPath}} needs to be resolved per-page,
 * not at the app level.
 */
function replaceTokensPreservingCurrentPath(
  value: unknown,
  context: Omit<TokenReplacementContext, 'currentPath'>
): unknown {
  if (typeof value === 'string') {
    // Only replace $t: patterns, keep {{currentPath}} as-is
    if (value.startsWith('$t:')) {
      const key = value.slice(3)
      return resolveTranslation(key, context.langCode, context.languages)
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensPreservingCurrentPath(item, context))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        replaceTokensPreservingCurrentPath(val, context),
      ])
    )
  }

  return value
}

/**
 * Replace translation tokens in app configuration for a specific language
 *
 * Resolves all $t:key patterns throughout the app for static site generation.
 * For defaultLayout, preserves {{currentPath}} placeholders to be resolved per-page.
 * This is a pure function that performs token replacement without throwing exceptions.
 * Callers should validate language codes before calling this function.
 *
 * @param app - App configuration (may contain $t:key tokens in pages and defaultLayout)
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

  // Create context for token replacement
  const context: TokenReplacementContext = {
    langCode,
    langConfig,
    languages: app.languages,
    translations,
  }

  // Replace tokens in pages (with currentPath resolution)
  const pages = app.pages?.map((page) => replacePageTokens(page, context))

  // Replace tokens in defaultLayout (preserving {{currentPath}} for per-page resolution)
  const defaultLayout = app.defaultLayout
    ? (replaceTokensPreservingCurrentPath(app.defaultLayout, context) as App['defaultLayout'])
    : app.defaultLayout

  // Return app with replaced pages and defaultLayout
  return {
    ...app,
    pages,
    defaultLayout,
  }
}
