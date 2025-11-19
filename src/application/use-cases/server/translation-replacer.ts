/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App, Page } from '@/domain/models/app'
import type { LanguageConfig } from '@/domain/models/app/language/language-config'

/**
 * Replace translation tokens in a string
 *
 * Replaces:
 * - {{lang}} → full locale (e.g., 'en-US', 'fr-FR') for meta.lang, short code otherwise
 * - {{locale}} → full locale (e.g., 'en-US', 'fr-FR')
 * - {{key.name}} → translation from translations dictionary
 *
 * @param str - String potentially containing tokens
 * @param langCode - Current language code (short form, e.g., 'en')
 * @param langConfig - Full language configuration object
 * @param translations - Translations dictionary for current language
 * @param useLocaleForLang - If true, replace {{lang}} with full locale instead of short code
 * @returns String with all tokens replaced
 */
function replaceTokens(
  str: string,
  langCode: string,
  langConfig: LanguageConfig,
  translations: Record<string, string>,
  useLocaleForLang: boolean = false
): string {
  const langReplacement = useLocaleForLang ? langConfig.locale : langCode
  return str
    .replace(/\{\{lang\}\}/g, langReplacement)
    .replace(/\{\{locale\}\}/g, langConfig.locale)
    .replace(/\{\{([a-zA-Z0-9._-]+)\}\}/g, (_, key) => {
      return translations[key] || `{{${key}}}`
    })
}

/**
 * Replace tokens in any value (recursively handles objects, arrays, strings)
 */
function replaceTokensInValue(
  value: unknown,
  langCode: string,
  langConfig: LanguageConfig,
  translations: Record<string, string>,
  useLocaleForLang: boolean = false
): unknown {
  if (typeof value === 'string') {
    return replaceTokens(value, langCode, langConfig, translations, useLocaleForLang)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensInValue(item, langCode, langConfig, translations, useLocaleForLang))
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = replaceTokensInValue(val, langCode, langConfig, translations, useLocaleForLang)
    }
    return result
  }

  return value
}

/**
 * Replace translation tokens in page meta specially
 * meta.lang uses full locale (en-US) instead of short code (en)
 */
function replaceMetaTokens(
  meta: Page['meta'],
  langCode: string,
  langConfig: LanguageConfig,
  translations: Record<string, string>
): Page['meta'] {
  if (!meta) return meta

  // Use full locale for {{lang}} replacement in meta
  return replaceTokensInValue(meta, langCode, langConfig, translations, true) as Page['meta']
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
  // Replace tokens in everything except meta
  const { meta, ...restOfPage } = page
  const replacedRest = replaceTokensInValue(restOfPage, langCode, langConfig, translations) as Omit<
    Page,
    'meta'
  >

  // Replace meta separately with special locale handling
  const replacedMeta = replaceMetaTokens(meta, langCode, langConfig, translations)

  return {
    ...replacedRest,
    meta: replacedMeta,
  } as Page
}

/**
 * Replace translation tokens in app configuration for a specific language
 *
 * @param app - App configuration (may contain tokens in pages)
 * @param langCode - Language code to generate for
 * @returns App with all tokens replaced for the language
 */
export function replaceAppTokens(app: App, langCode: string): App {
  // If no languages configured, return app as-is
  if (!app.languages) {
    return app
  }

  // Find language config
  const langConfig = app.languages.supported.find((lang) => lang.code === langCode)
  if (!langConfig) {
    throw new Error(`Language code '${langCode}' not found in supported languages`)
  }

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
