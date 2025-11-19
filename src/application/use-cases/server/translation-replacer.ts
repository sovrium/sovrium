/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App, Page } from '@/domain/models/app'
import type { LanguageConfig } from '@/domain/models/app/language/language-config'

/**
 * Context for token replacement operations
 */
type TokenReplacementContext = {
  readonly langCode: string
  readonly langConfig: LanguageConfig
  readonly translations: Record<string, string>
  readonly useLocaleForLang: boolean
}

/**
 * Replace translation tokens in a string
 *
 * Replaces:
 * - {{lang}} → full locale (e.g., 'en-US', 'fr-FR') for meta.lang, short code otherwise
 * - {{locale}} → full locale (e.g., 'en-US', 'fr-FR')
 * - {{key.name}} → translation from translations dictionary
 *
 * @param str - String potentially containing tokens
 * @param context - Token replacement context
 * @returns String with all tokens replaced
 */
function replaceTokens(str: string, context: TokenReplacementContext): string {
  const langReplacement = context.useLocaleForLang ? context.langConfig.locale : context.langCode
  return str
    .replace(/\{\{lang\}\}/g, langReplacement)
    .replace(/\{\{locale\}\}/g, context.langConfig.locale)
    .replace(/\{\{([a-zA-Z0-9._-]+)\}\}/g, (_, key) => {
      return context.translations[key] || `{{${key}}}`
    })
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
 * Replace translation tokens in page meta specially
 * meta.lang uses full locale (en-US) instead of short code (en)
 */
function replaceMetaTokens(meta: Page['meta'], context: TokenReplacementContext): Page['meta'] {
  if (!meta) return meta

  // Use full locale for {{lang}} replacement in meta
  const metaContext: TokenReplacementContext = { ...context, useLocaleForLang: true }
  return replaceTokensInValue(meta, metaContext) as Page['meta']
}

/**
 * Replace translation tokens in a page configuration
 *
 * Special handling for meta.lang field: uses full locale instead of short code
 *
 * @param page - Page with potential translation tokens
 * @param langCode - Language code (e.g., 'en', 'fr')
 * @param langConfig - Language configuration object
 * @param translations - Translations for the language
 * @returns Page with tokens replaced
 */
export function replacePageTokens(
  page: Page,
  langCode: string,
  langConfig: LanguageConfig,
  translations: Record<string, string>
): Page {
  const context: TokenReplacementContext = {
    langCode,
    langConfig,
    translations,
    useLocaleForLang: false,
  }

  // Replace tokens in everything except meta
  const { meta, ...restOfPage } = page
  const replacedRest = replaceTokensInValue(restOfPage, context) as Omit<Page, 'meta'>

  // Replace meta separately with special locale handling
  const replacedMeta = replaceMetaTokens(meta, context)

  return {
    ...replacedRest,
    meta: replacedMeta,
  } as Page
}

/**
 * Replace translation tokens in app configuration for a specific language
 *
 * This is a pure function that performs token replacement without throwing exceptions.
 * Callers should validate language codes before calling this function.
 *
 * @param app - App configuration (may contain tokens in pages)
 * @param langCode - Language code to generate for
 * @returns App with all tokens replaced for the language
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
    replacePageTokens(page, langCode, langConfig, translations)
  )

  // Return app with replaced pages
  return {
    ...app,
    pages,
  }
}
