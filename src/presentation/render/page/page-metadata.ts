/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useContext } from 'react'
import { primaryPagePath } from '@/domain/kernel/matching/localized-path'
import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { resolveFrontmatterReferences } from '@/domain/models/app/pages/frontmatter-reference-service'
import { HeadReferencesContext, type HeadReferences } from './head-references'
import { PageLanguageAlternatesContext, selfCanonicalFor } from './page-alternates'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'

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
 * The body-face fields that map one-to-one onto a CSS declaration, as
 * `[CSS property, face field]`.
 *
 * A table rather than one conditional spread per field: the spreads were five
 * branches in a row, which is most of a complexity budget spent on a mapping
 * that has no logic in it. Adding a sixth field is a row here.
 *
 * `size`, `lineHeight` and `weights` are NOT in this table on purpose — they
 * are the superseded face fields no renderer reads. Two of them appear below
 * only because this style attribute predates that finding.
 */
const BODY_STYLE_FIELDS = [
  ['fontSize', 'size'],
  ['lineHeight', 'lineHeight'],
  ['fontStyle', 'style'],
  ['letterSpacing', 'letterSpacing'],
  ['textTransform', 'transform'],
] as const

/**
 * Build the inline body style from the design's body face, or `undefined` when
 * no body face is declared.
 */
function buildBodyStyle(design: Design | undefined): PageMetadata['bodyStyle'] {
  const body = design?.typeScale?.families?.body
  if (body === undefined) {
    return undefined
  }

  const fontFamily = buildFontFamily(body.family, body.fallback)
  const declared = Object.fromEntries(
    BODY_STYLE_FIELDS.flatMap(([cssProperty, field]) => {
      const value = body[field]
      return value === undefined || value === '' ? [] : [[cssProperty, value] as const]
    })
  )

  return {
    ...(fontFamily === undefined || fontFamily === '' ? {} : { fontFamily }),
    ...declared,
  }
}

/** The two fields an author may translate per language in `meta.i18n`. */
type AuthoredMetaEntry = {
  readonly title?: string | undefined
  readonly description?: string | undefined
}

/**
 * The author's own `meta.i18n` entry for the active language.
 *
 * `meta.i18n` is the escape hatch for a title that is not a dictionary key, so
 * it is hand-written and its keys are whatever the author chose — a short `fr`
 * or a full `fr-FR`, both legal spellings of one language. The active language
 * is always the app's DECLARED locale (`resolvePageLanguage`), so a bare
 * `i18n[lang]` read `i18n['fr-FR']` and missed a `fr`-keyed entry: the page
 * silently fell back to its base title, which is what a search engine indexes
 * and what a shared link shows.
 *
 * The shared lookup matches the exact tag FIRST — so an author who
 * deliberately keys `fr-FR` still gets that entry, and a future `pt-BR` is
 * never shadowed by a `pt` — and only then relaxes to the primary subtag.
 * Normalising every lookup down to the short code instead would have repaired
 * one spelling by breaking the other.
 */
function authoredMetaFor(page: Page, lang: string): AuthoredMetaEntry | undefined {
  const table: Readonly<Record<string, AuthoredMetaEntry | undefined>> = page.meta?.i18n ?? {}
  return resolveForLanguage(table, lang, undefined)
}

/**
 * Determine page title with frontmatter + translation resolution.
 *
 * Priority: meta.i18n[lang].title > meta.title ($frontmatter.* then $t:) > the
 * article's own frontmatter `title` > page.name > page.path.
 *
 * A markdown page is one route per file, so the article's `title` names the
 * document better than the page definition's name does. And a `meta.title`
 * whose references all resolve to nothing falls back the same way: a document
 * must never ship an empty `<title>` (RGAA 8.5, WCAG 2.4.2).
 */
function determineTitle(
  page: Page,
  lang: string,
  languages: Languages | undefined,
  frontmatter: Readonly<Record<string, string>> | undefined
): string {
  // Check if page has i18n translations for this language
  const authoredTitle = authoredMetaFor(page, lang)?.title
  if (authoredTitle) {
    return authoredTitle
  }

  const fallback = frontmatter?.['title'] || page.name || primaryPagePath(page.path)
  const declared = page.meta?.title
    ? resolveFrontmatterReferences(page.meta.title, frontmatter)
    : ''
  const rawTitle = declared.trim() === '' ? fallback : declared
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
  const authoredDescription = authoredMetaFor(page, lang)?.description
  if (authoredDescription) {
    return authoredDescription
  }

  // Fall back to base description with $frontmatter.* then $t: pattern resolution
  const rawDescription = resolveFrontmatterReferences(page.meta?.description || '', frontmatter)
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

  const rawKeywords = resolveFrontmatterReferences(page.meta.keywords, frontmatter)
  return resolveTranslationPattern(rawKeywords, lang, languages)
}

/**
 * Extracts and computes metadata from page configuration.
 *
 * The active `lang` is supplied by the caller rather than re-derived here. A
 * private copy of the locale precedence chain, independent of
 * `resolvePageLanguage`, lets a fix to one leave the other stale — shipping a
 * French page with an English `<title>`. There is one source of truth:
 * `resolvePageLanguage`.
 *
 * @param page - Page configuration
 * @param design - Optional design configuration
 * @param languages - Optional languages configuration
 * @param options - Active language, rendered-markdown frontmatter (`$frontmatter.*`),
 *   and the request's `$app.*` / `$param.*` substitution, applied AFTER
 *   translation so a reference inside a `$t:` value resolves too
 * @returns Computed page metadata
 */
export function extractPageMetadata(
  page: Page,
  design: Design | undefined,
  languages: Languages | undefined,
  options: {
    readonly lang: string
    readonly frontmatter?: Readonly<Record<string, string>>
    /** `$app.*` / `$param.*` in the TRANSLATED title and description. */
    readonly headReferences?: HeadReferences
  }
): Readonly<PageMetadata> {
  const { lang, frontmatter } = options
  const resolveReferences = options.headReferences ?? ((text: string) => text)
  const title = resolveReferences(determineTitle(page, lang, languages, frontmatter))
  const description = resolveReferences(determineDescription(page, lang, languages, frontmatter))
  const keywords = determineKeywords(page, lang, languages, frontmatter)
  // A `$t:` key resolves like the title's, so each language can name its own address.
  const canonical =
    page.meta?.canonical === undefined
      ? undefined
      : resolveTranslationPattern(page.meta.canonical, lang, languages)
  const bodyStyle = buildBodyStyle(design)

  return {
    title,
    description,
    keywords,
    canonical,
    bodyStyle,
  }
}

/**
 * {@link extractPageMetadata} for the document being rendered, with the head's
 * `$app.*` / `$param.*` substitution read from `HeadReferencesContext` — which
 * `renderPageHtml` provides once per request — and, for a page that declares no
 * canonical, its own address in the active language ({@link selfCanonicalFor}).
 */
export const usePageMetadata = (
  page: Page,
  design: Design | undefined,
  languages: Languages | undefined,
  options: Omit<Parameters<typeof extractPageMetadata>[3], 'headReferences'>
): Readonly<PageMetadata> => {
  const metadata = extractPageMetadata(page, design, languages, {
    ...options,
    headReferences: useContext(HeadReferencesContext),
  })
  const alternates = useContext(PageLanguageAlternatesContext)
  const canonical = metadata.canonical ?? selfCanonicalFor(alternates, options.lang, languages)
  return canonical === undefined ? metadata : { ...metadata, canonical }
}
