/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Metadata derived from page configuration
 */
export type PageMetadata = {
  readonly lang: string
  readonly direction: 'ltr' | 'rtl'
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly bodyStyle:
    | {
        readonly fontFamily?: string
        readonly fontSize?: string
        readonly lineHeight?: string
        readonly fontStyle?: 'normal' | 'italic' | 'oblique'
        readonly letterSpacing?: string
        readonly textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
      }
    | undefined
}

/**
 * Build font-family string with fallback
 */
function buildFontFamily(family?: string, fallback?: string): string | undefined {
  if (!family) {
    return undefined
  }
  return fallback ? `${family}, ${fallback}` : family
}

/**
 * Build body style object from theme fonts configuration
 */
function buildBodyStyle(theme: Theme | undefined): PageMetadata['bodyStyle'] {
  if (!theme?.fonts?.body) {
    return undefined
  }

  const { body } = theme.fonts
  const fontFamily = buildFontFamily(body.family, body.fallback)

  return {
    ...(fontFamily && { fontFamily }),
    ...(body.size && { fontSize: body.size }),
    ...(body.lineHeight && { lineHeight: body.lineHeight }),
    ...(body.style && { fontStyle: body.style as 'normal' | 'italic' | 'oblique' }),
    ...(body.letterSpacing && { letterSpacing: body.letterSpacing }),
    ...(body.transform && {
      textTransform: body.transform as 'none' | 'uppercase' | 'lowercase' | 'capitalize',
    }),
  }
}

/**
 * Determine language code (priority: page.meta.lang > detectedLanguage > default)
 */
function determineLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined
): string {
  return page.meta?.lang || detectedLanguage || languages?.default || 'en-US'
}

/**
 * Determine text direction from language configuration
 */
function determineDirection(languages: Languages | undefined, lang: string): 'ltr' | 'rtl' {
  const langConfig = languages?.supported.find((l) => l.code === lang)
  return langConfig?.direction || 'ltr'
}

/**
 * Determine page title with translation resolution
 * Priority: meta.i18n[lang].title > meta.title (with $t: pattern) > page.name > page.path
 */
function determineTitle(page: Page, lang: string, languages: Languages | undefined): string {
  // Check if page has i18n translations for this language
  if (page.meta?.i18n?.[lang]?.title) {
    return page.meta.i18n[lang].title
  }

  // Fall back to base title with translation pattern resolution
  const rawTitle = page.meta?.title || page.name || page.path
  return resolveTranslationPattern(rawTitle, lang, languages)
}

/**
 * Determine page description with translation resolution
 * Priority: meta.i18n[lang].description > meta.description (with $t: pattern)
 */
function determineDescription(page: Page, lang: string, languages: Languages | undefined): string {
  // Check if page has i18n translations for this language
  if (page.meta?.i18n?.[lang]?.description) {
    return page.meta.i18n[lang].description
  }

  // Fall back to base description with translation pattern resolution
  const rawDescription = page.meta?.description || ''
  return resolveTranslationPattern(rawDescription, lang, languages)
}

/**
 * Determine page keywords with translation resolution
 * Resolves $t: patterns in keywords
 */
function determineKeywords(
  page: Page,
  lang: string,
  languages: Languages | undefined
): string | undefined {
  if (!page.meta?.keywords) {
    return undefined
  }

  return resolveTranslationPattern(page.meta.keywords, lang, languages)
}

/**
 * Extracts and computes metadata from page configuration
 *
 * Determines language (page.meta.lang > detectedLanguage > default),
 * text direction from language config, title/description, and body styles from theme.
 *
 * @param page - Page configuration
 * @param theme - Optional theme configuration
 * @param languages - Optional languages configuration
 * @param detectedLanguage - Optional detected language from browser or URL
 * @returns Computed page metadata
 */
export function extractPageMetadata(
  page: Page,
  theme: Theme | undefined,
  languages: Languages | undefined,
  detectedLanguage: string | undefined
): Readonly<PageMetadata> {
  const lang = determineLanguage(page, languages, detectedLanguage)
  const direction = determineDirection(languages, lang)
  const title = determineTitle(page, lang, languages)
  const description = determineDescription(page, lang, languages)
  const keywords = determineKeywords(page, lang, languages)
  const canonical = page.meta?.canonical
  const bodyStyle = buildBodyStyle(theme)

  return {
    lang,
    direction,
    title,
    description,
    keywords,
    canonical,
    bodyStyle,
  }
}
