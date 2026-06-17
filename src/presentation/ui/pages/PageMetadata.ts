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

function buildFontFamily(family?: string, fallback?: string): string | undefined {
  if (!family) {
    return undefined
  }
  return fallback ? `${family}, ${fallback}` : family
}

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

function determineLanguage(
  page: Page,
  languages: Languages | undefined,
  detectedLanguage: string | undefined
): string {
  return page.meta?.lang || detectedLanguage || languages?.default || 'en-US'
}

function determineDirection(languages: Languages | undefined, lang: string): 'ltr' | 'rtl' {
  const langConfig = languages?.supported.find((l) => l.code === lang)
  return langConfig?.direction || 'ltr'
}

function resolveFrontmatterPattern(
  value: string,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  const prefix = '$frontmatter.'
  if (!value.startsWith(prefix)) return value
  const key = value.slice(prefix.length)
  return frontmatter?.[key] ?? ''
}

function determineTitle(
  page: Page,
  lang: string,
  languages: Languages | undefined,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  if (page.meta?.i18n?.[lang]?.title) {
    return page.meta.i18n[lang].title
  }

  const rawTitle = resolveFrontmatterPattern(
    page.meta?.title || page.name || page.path,
    frontmatter
  )
  return resolveTranslationPattern(rawTitle, lang, languages)
}

function determineDescription(
  page: Page,
  lang: string,
  languages: Languages | undefined,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  if (page.meta?.i18n?.[lang]?.description) {
    return page.meta.i18n[lang].description
  }

  const rawDescription = resolveFrontmatterPattern(page.meta?.description || '', frontmatter)
  return resolveTranslationPattern(rawDescription, lang, languages)
}

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

export function extractPageMetadata(
  page: Page,
  theme: Theme | undefined,
  languages: Languages | undefined,
  options?: {
    readonly detectedLanguage?: string
    readonly frontmatter?: Readonly<Record<string, string>>
  }
): Readonly<PageMetadata> {
  const { detectedLanguage, frontmatter } = options ?? {}
  const lang = determineLanguage(page, languages, detectedLanguage)
  const direction = determineDirection(languages, lang)
  const title = determineTitle(page, lang, languages, frontmatter)
  const description = determineDescription(page, lang, languages, frontmatter)
  const keywords = determineKeywords(page, lang, languages, frontmatter)
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
