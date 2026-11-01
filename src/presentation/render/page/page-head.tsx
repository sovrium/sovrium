/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement, useContext } from 'react'
import { analyticsConsentHold } from '@/domain/models/app/consent/consent-version-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import {
  mergeContentDirOpenGraph,
  type ContentDirSeoMeta,
} from '@/domain/models/app/pages/content-dir-seo-meta'
import { withArticleLanguage } from '@/domain/models/app/pages/content-dir-structured-data'
import { normalizeFavicons } from '@/domain/models/app/pages/meta/favicon-transformer'
import { robotsDirectiveOf } from '@/domain/models/app/pages/sitemap-builder'
import {
  AnalyticsHead,
  CustomElementsHead,
  DnsPrefetchLinks,
  FaviconLink,
  FaviconSetLinks,
  OpenGraphMeta,
  PreloadLinks,
  StructuredDataScript,
  TwitterCardMeta,
} from '@/presentation/render/page'
import {
  renderInlineScriptTag,
  renderScriptTag,
} from '@/presentation/render/scripts/script-renderers'
import { HeadReferencesContext, type HeadReferences } from './head-references'
import { twitterFallbacks, withPageValue } from './page-head-cards'
import { GoogleFonts, SansFontPreload, ThemeFonts } from './page-head-fonts'
import { HeadAlternateLinks } from './page-head-seo'
import { checkedAddress, withCheckedUrl } from './page-head-sharing-address'
import { ThemeColorSchemeScript } from './theme-color-scheme-script'
import type { FeedAnnouncement } from './page-alternates'
import type { GroupedScripts } from './page-scripts'
import type { Design } from '@/domain/models/app/design'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { CustomElement, OpenGraph } from '@/domain/models/app/pages/meta'

/**
 * Props for PageHead component
 */
type PageHeadProps = {
  readonly page: Page
  readonly design: Design | undefined
  readonly directionStyles: string
  /**
   * Content-versioned stylesheet URL (`/assets/output-<hash8>.css`), computed
   * by the server-side renderer. Falls back to the unversioned
   * `/assets/output.css` when absent so partial render paths stay styled.
   */
  readonly cssHref?: string
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly lang: string
  readonly languages?: Languages
  readonly scripts: GroupedScripts
  /**
   * SEO meta synthesised for a `contentDir` page. When present its canonical/alternates/openGraph values take
   * precedence over (or supplement) the page-meta-derived values because a
   * content-directory page has no statically-authored `page.meta` for the
   * per-file slug.
   */
  readonly contentDirSeo?: ContentDirSeoMeta
  /** The RSS feed this page publishes, or `undefined` — see `HeadAlternateLinks`. */
  readonly feed?: FeedAnnouncement | undefined
}

/**
 * Checks if custom elements include a viewport meta tag
 */
function hasCustomViewportMeta(customElements: readonly CustomElement[] | undefined): boolean {
  if (!customElements) return false
  return customElements.some(
    (element) => element.type === 'meta' && element.attrs?.name === 'viewport'
  )
}

/**
 * Extracts OpenGraph properties from meta object
 * Handles both standard openGraph object and og:* prefixed direct properties
 */
function extractOpenGraphData(
  page: Page,
  lang: string,
  languages: Languages | undefined
): OpenGraph | undefined {
  if (!page.meta) return undefined

  // Start with existing openGraph object if present
  const openGraph = page.meta.openGraph || {}

  // Extract og:* prefixed properties from meta (type assertion needed for dynamic access)
  const metaRecord = page.meta as Record<string, unknown>
  const ogSiteName = metaRecord['og:site_name']

  // Resolve translation patterns in extracted properties
  const resolvedSiteName =
    typeof ogSiteName === 'string'
      ? resolveTranslationPattern(ogSiteName, lang, languages)
      : undefined

  // Merge og:* properties into openGraph structure
  const merged = {
    ...openGraph,
    ...(resolvedSiteName && { siteName: resolvedSiteName }),
  }

  // Only return if there's at least one property
  return Object.keys(merged).length > 0 ? merged : undefined
}

/**
 * Renders basic meta tags (charset, viewport, title, description, keywords,
 * robots, canonical)
 */
function BasicMetaTags({
  title,
  description,
  keywords,
  canonical,
  robots,
  hasCustomViewport,
}: {
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly robots?: string
  readonly hasCustomViewport: boolean
}): ReactElement {
  return (
    <>
      <meta charSet="UTF-8" />
      {!hasCustomViewport && (
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
      )}
      <title>{title}</title>
      {description && (
        <meta
          name="description"
          content={description}
        />
      )}
      {keywords && (
        <meta
          name="keywords"
          content={keywords}
        />
      )}
      {robots && (
        <meta
          name="robots"
          content={robots}
        />
      )}
      {canonical && (
        <link
          rel="canonical"
          href={canonical}
        />
      )}
    </>
  )
}

/**
 * Renders custom stylesheet link from meta.stylesheet
 */
function CustomStylesheet({
  stylesheet,
}: {
  readonly stylesheet: string | undefined
}): ReactElement | undefined {
  if (!stylesheet) return undefined

  return (
    <link
      rel="stylesheet"
      href={stylesheet}
    />
  )
}

/**
 * Renders global CSS and direction styles
 * Design CSS is compiled globally at /assets/output.css
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: RTL direction styles (build-time generated CSS)
 * - Source: directionStyles prop computed from language direction
 * - Risk: None - contains only CSS direction properties
 * - Validation: Generated by language direction logic (ltr/rtl)
 * - Purpose: Apply RTL-aware styling for Arabic/Hebrew languages
 * - XSS Protection: CSS syntax prevents script execution
 * - Content: Fixed format like "[dir='rtl'] { direction: rtl; }"
 */
function GlobalStyles({
  directionStyles,
  cssHref,
}: {
  readonly directionStyles: string
  readonly cssHref?: string
}): ReactElement {
  return (
    <>
      <link
        rel="stylesheet"
        href={cssHref ?? '/assets/output.css'}
      />
      {/* eslint-disable-next-line sovrium/require-sanitized-html -- engine-generated direction CSS */}
      <style dangerouslySetInnerHTML={{ __html: directionStyles }} />
    </>
  )
}

/**
 * Renders external and inline scripts for head section
 * Note: APP_CONFIG is rendered in body-end to merge with inline scripts
 */
function HeadScripts({ scripts }: { readonly scripts: GroupedScripts }): ReactElement {
  return (
    <>
      {scripts.external.head.map((script, index) =>
        renderScriptTag({
          src: script.src,
          async: script.async,
          defer: script.defer,
          module: script.module,
          integrity: script.integrity,
          crossOrigin: script.crossorigin,
          reactKey: `head-${index}`,
          consent: script.consent,
        })
      )}
      {scripts.inline.head.map((script, index) =>
        renderInlineScriptTag({
          code: script.code,
          async: script.async,
          reactKey: `inline-head-${index}`,
          consent: script.consent,
        })
      )}
    </>
  )
}

/**
 * Renders the complete <head> section of a dynamic page
 *
 * Includes:
 * - Basic meta tags (charset, viewport, title, description)
 * - OpenGraph and Twitter Card metadata
 * - Structured data (JSON-LD)
 * - Preload hints for critical resources
 * - DNS prefetch hints
 * - Analytics scripts
 * - Custom elements
 * - Favicon links
 * - Custom stylesheet from meta.stylesheet
 * - Google Fonts with preconnect hints from meta.googleFonts
 * - Font stylesheets from design
 * - Global CSS with compiled design tokens
 * - Direction styles for RTL support
 * - External and inline scripts positioned in head
 *
 * @param props - Component props
 * @returns Head section elements
 */
/** The providers of a page, held back when the app declares an `analytics` purpose. */
const analyticsHeadProps = (page: Page, scripts: GroupedScripts) => ({
  analytics: page.meta?.analytics,
  heldForConsent: analyticsConsentHold(scripts.consent?.declaration) !== undefined,
})

/**
 * Pre-compute the head meta values that combine page-meta with a contentDir
 * page's synthesised SEO (canonical / merged Open Graph). Extracted so
 * `PageHead` stays under its complexity + line caps.
 */
function computeHeadMeta(
  props: PageHeadProps,
  references: HeadReferences
): {
  readonly openGraphData: OpenGraph | undefined
  readonly effectiveCanonical: string | undefined
  readonly twitterFallback: ReturnType<typeof twitterFallbacks>
  readonly synthesizedJsonLd: readonly Record<string, unknown>[]
} {
  const { page, lang, languages, canonical, contentDirSeo, description, title } = props
  // A declared card without a description or a title takes the page's own; the
  // title only after a contentDir page's synthesised card has supplied its own.
  const openGraphData = withCheckedUrl(
    withPageValue(
      page,
      mergeContentDirOpenGraph(
        withPageValue(
          page,
          extractOpenGraphData(page, lang, languages),
          'description',
          description
        ),
        contentDirSeo
      ),
      'title',
      title
    ),
    lang,
    languages,
    references
  )
  return {
    openGraphData,
    // A contentDir page has no statically-authored `page.meta.canonical`, so
    // the synthesised canonical (resolved slug URL) takes precedence.
    effectiveCanonical: checkedAddress(contentDirSeo?.canonical ?? canonical),
    // What X reads in the absence of `twitter:title` / `twitter:description`.
    twitterFallback: twitterFallbacks(openGraphData, { title, description }, lang, languages),
    // Auto-synthesised JSON-LD documents (TechArticle + BreadcrumbList) for
    // contentDir pages; empty when synthesis is off or author-overridden.
    synthesizedJsonLd: withArticleLanguage(contentDirSeo?.structuredData ?? [], lang),
  }
}

export function PageHead(props: PageHeadProps): Readonly<ReactElement> {
  const { page, design, directionStyles, title, description, keywords, lang, languages, scripts } =
    props
  const hasCustomViewport = hasCustomViewportMeta(page.meta?.customElements)
  const normalizedFavicons = normalizeFavicons(page.meta?.favicons)
  const references = useContext(HeadReferencesContext)
  const { openGraphData, effectiveCanonical, twitterFallback, synthesizedJsonLd } = computeHeadMeta(
    props,
    references
  )

  return (
    <>
      <BasicMetaTags
        title={title}
        description={description}
        keywords={keywords}
        canonical={effectiveCanonical}
        robots={robotsDirectiveOf(page)}
        hasCustomViewport={hasCustomViewport}
      />
      {/* No-FOUC color-scheme bootstrap — emitted before the stylesheet so the
          `dark` class lands on <html> ahead of first paint, on every page. */}
      <ThemeColorSchemeScript design={design} />
      <OpenGraphMeta
        openGraph={openGraphData}
        lang={lang}
        languages={languages}
      />
      <TwitterCardMeta
        page={page}
        lang={lang}
        languages={languages}
        fallbackTitle={twitterFallback.title}
        fallbackDescription={twitterFallback.description}
      />
      <StructuredDataScript
        page={page}
        synthesized={synthesizedJsonLd}
        resolveText={(text) => references(resolveTranslationPattern(text, lang, languages))}
      />
      <PreloadLinks preload={page.meta?.preload} />
      <DnsPrefetchLinks dnsPrefetch={page.meta?.dnsPrefetch} />
      <HeadAlternateLinks {...props} />
      <AnalyticsHead {...analyticsHeadProps(page, props.scripts)} />
      <CustomElementsHead customElements={page.meta?.customElements} />
      <FaviconLink favicon={page.meta?.favicon} />
      <FaviconSetLinks favicons={normalizedFavicons} />
      <CustomStylesheet stylesheet={page.meta?.stylesheet} />
      <GoogleFonts googleFonts={page.meta?.googleFonts} />
      <ThemeFonts design={design} />
      <SansFontPreload design={design} />
      <GlobalStyles
        directionStyles={directionStyles}
        cssHref={props.cssHref}
      />
      <HeadScripts scripts={scripts} />
    </>
  )
}
