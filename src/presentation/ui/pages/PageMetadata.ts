/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
 * Resolve a `$frontmatter.<key>` reference against the rendered markdown's
 * frontmatter (a flat Record). When the value is not a `$frontmatter.*`
 * reference, or the page has no markdown frontmatter, the input passes through
 * unchanged so `$t:`/literal handling downstream is unaffected. A missing key
 * resolves to an empty string (the reference is consumed, not leaked).
 *
 * Runs BEFORE `$t:` resolution so a frontmatter value that itself contains a
 * `$t:` token still localises.
 */
function resolveFrontmatterPattern(
  value: string,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  const prefix = '$frontmatter.'
  if (!value.startsWith(prefix)) return value
  const key = value.slice(prefix.length)
  return frontmatter?.[key] ?? ''
}

/**
 * Determine page title with frontmatter + translation resolution
 * Priority: meta.i18n[lang].title > meta.title ($frontmatter.* then $t:) > page.name > page.path
 */
function determineTitle(
  page: Page,
  lang: string,
  languages: Languages | undefined,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  // Check if page has i18n translations for this language
  if (page.meta?.i18n?.[lang]?.title) {
    return page.meta.i18n[lang].title
  }

  // Fall back to base title with $frontmatter.* then $t: pattern resolution
  const rawTitle = resolveFrontmatterPattern(
    page.meta?.title || page.name || page.path,
    frontmatter
  )
  return resolveTranslationPattern(rawTitle, lang, languages)
}

/**
 * Determine page description with frontmatter + translation resolution
 * Priority: meta.i18n[lang].description > meta.description ($frontmatter.* then $t:)
 */
function determineDescription(
  page: Page,
  lang: string,
  languages: Languages | undefined,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  // Check if page has i18n translations for this language
  if (page.meta?.i18n?.[lang]?.description) {
    return page.meta.i18n[lang].description
  }

  // Fall back to base description with $frontmatter.* then $t: pattern resolution
  const rawDescription = resolveFrontmatterPattern(page.meta?.description || '', frontmatter)
  return resolveTranslationPattern(rawDescription, lang, languages)
}

/**
 * Determine page keywords with frontmatter + translation resolution
 * Resolves $frontmatter.* then $t: patterns in keywords
 */
function determineKeywords(
  page: Page,
  lang: string,
  languages: Languages | undefined,
  frontmatter: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (!page.meta?.keywords) {
    return undefined
  }

  const rawKeywords = resolveFrontmatterPattern(page.meta.keywords, frontmatter)
  return resolveTranslationPattern(rawKeywords, lang, languages)
}

/**
 * Extracts and computes metadata from page configuration.
 *
 * The active `lang` is supplied by the caller rather than re-derived here. This
 * file used to carry its OWN copy of the locale precedence chain, independent of
 * `resolvePageLanguage` — so a fix to one left the other stale and shipped a
 * French page with an English `<title>`. There is now a
 * single source of truth: `resolvePageLanguage`.
 *
 * @param page - Page configuration
 * @param theme - Optional theme configuration
 * @param languages - Optional languages configuration
 * @param options - Active language + rendered-markdown frontmatter (`$frontmatter.*`)
 * @returns Computed page metadata
 */
export function extractPageMetadata(
  page: Page,
  theme: Theme | undefined,
  languages: Languages | undefined,
  options: {
    readonly lang: string
    readonly frontmatter?: Readonly<Record<string, string>>
  }
): Readonly<PageMetadata> {
  const { lang, frontmatter } = options
  const title = determineTitle(page, lang, languages, frontmatter)
  const description = determineDescription(page, lang, languages, frontmatter)
  const keywords = determineKeywords(page, lang, languages, frontmatter)
  const canonical = page.meta?.canonical
  const bodyStyle = buildBodyStyle(theme)

  return {
    title,
    description,
    keywords,
    canonical,
    bodyStyle,
  }
}
