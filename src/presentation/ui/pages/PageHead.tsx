/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { normalizeFavicons } from '@/application/metadata/favicon-transformer'
import {
  mergeContentDirOpenGraph,
  type ContentDirSeoMeta,
} from '@/domain/utils/content-dir/content-dir-seo-meta'
import { renderInlineScriptTag, renderScriptTag } from '@/presentation/scripts/script-renderers'
import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
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
} from '@/presentation/ui/metadata'
import { HreflangSection } from './PageHeadSeo'
import { ThemeColorSchemeScript } from './ThemeColorSchemeScript'
import type { GroupedScripts } from './PageScripts'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { CustomElement, OpenGraph } from '@/domain/models/app/pages/meta'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Props for PageHead component
 */
type PageHeadProps = {
  readonly page: Page
  /** `app.components` templates — forwarded to the no-FOUC color-scheme
   * detection so a template-hosted `theme-toggle` emits the boot script. */
  readonly components?: Components
  readonly theme: Theme | undefined
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
 * Resolve the `<meta name="robots">` directive for a page.
 *
 * Reads `meta.robots` (free-form directive string, e.g. `'noindex, nofollow'`)
 * with `meta.noindex: true` as a shorthand for `'noindex'`. When both are set,
 * the explicit `robots` string wins. Returns `undefined` when neither is set so
 * pages stay indexable by default (no tag emitted).
 *
 * This is what marks the built-in 404 / not-found pages as `noindex`
 * and lets any page opt out of indexing via the
 * existing schema fields.
 */
function resolveRobotsDirective(page: Page): string | undefined {
  const robots = page.meta?.robots
  if (typeof robots === 'string' && robots.length > 0) return robots
  return page.meta?.noindex === true ? 'noindex' : undefined
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
 * Renders font stylesheets from theme configuration
 */
function ThemeFonts({ theme }: { readonly theme: Theme | undefined }): ReactElement | undefined {
  if (!theme?.fonts) return undefined

  return (
    <>
      {Object.values(theme.fonts).map((font, index) =>
        font.url ? (
          <link
            key={`font-${index}`}
            rel="stylesheet"
            href={font.url}
          />
        ) : undefined
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
 * Renders Google Fonts with performance optimizations
 * Includes preconnect hints for fonts.googleapis.com and fonts.gstatic.com
 */
function GoogleFonts({
  googleFonts,
}: {
  readonly googleFonts: string | undefined
}): ReactElement | undefined {
  if (!googleFonts) return undefined

  return (
    <>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href={googleFonts}
      />
    </>
  )
}

/**
 * Renders global CSS and direction styles
 * Theme CSS is compiled globally at /assets/output.css
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
      {/* eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <style> element; never re-renders client-side */}
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
        })
      )}
      {scripts.inline.head.map((script, index) =>
        renderInlineScriptTag({
          code: script.code,
          async: script.async,
          reactKey: `inline-head-${index}`,
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
 * - Font stylesheets from theme
 * - Global CSS with compiled theme tokens
 * - Direction styles for RTL support
 * - External and inline scripts positioned in head
 *
 * @param props - Component props
 * @returns Head section elements
 */
/**
 * Pre-compute the head meta values that combine page-meta with a contentDir
 * page's synthesised SEO (canonical / merged Open Graph). Extracted so
 * `PageHead` stays under its complexity + line caps.
 */
function computeHeadMeta(props: PageHeadProps): {
  readonly openGraphData: OpenGraph | undefined
  readonly effectiveCanonical: string | undefined
  readonly synthesizedJsonLd: readonly Record<string, unknown>[]
} {
  const { page, lang, languages, canonical, contentDirSeo } = props
  return {
    openGraphData: mergeContentDirOpenGraph(
      extractOpenGraphData(page, lang, languages),
      contentDirSeo
    ),
    // A contentDir page has no statically-authored `page.meta.canonical`, so
    // the synthesised canonical (resolved slug URL) takes precedence.
    effectiveCanonical: contentDirSeo?.canonical ?? canonical,
    // Auto-synthesised JSON-LD documents (TechArticle + BreadcrumbList) for
    // contentDir pages; empty when synthesis is off or author-overridden.
    synthesizedJsonLd: contentDirSeo?.structuredData ?? [],
  }
}

export function PageHead(props: PageHeadProps): Readonly<ReactElement> {
  const { page, theme, directionStyles, title, description, keywords, lang, languages, scripts } =
    props
  const { components, contentDirSeo } = props
  const hasCustomViewport = hasCustomViewportMeta(page.meta?.customElements)
  const normalizedFavicons = normalizeFavicons(page.meta?.favicons)
  const { openGraphData, effectiveCanonical, synthesizedJsonLd } = computeHeadMeta(props)

  return (
    <>
      <BasicMetaTags
        title={title}
        description={description}
        keywords={keywords}
        canonical={effectiveCanonical}
        robots={resolveRobotsDirective(page)}
        hasCustomViewport={hasCustomViewport}
      />
      {/* No-FOUC color-scheme bootstrap — emitted before the stylesheet so the
          `dark` class lands on <html> ahead of first paint (only when a
          theme-toggle or theme.colorScheme is in play). */}
      <ThemeColorSchemeScript
        page={page}
        components={components}
        theme={theme}
      />
      <OpenGraphMeta
        openGraph={openGraphData}
        lang={lang}
        languages={languages}
      />
      <TwitterCardMeta
        page={page}
        lang={lang}
        languages={languages}
      />
      <StructuredDataScript
        page={page}
        synthesized={synthesizedJsonLd}
      />
      <PreloadLinks preload={page.meta?.preload} />
      <DnsPrefetchLinks dnsPrefetch={page.meta?.dnsPrefetch} />
      <HreflangSection
        page={page}
        languages={languages}
        contentDirSeo={contentDirSeo}
      />
      <AnalyticsHead analytics={page.meta?.analytics} />
      <CustomElementsHead customElements={page.meta?.customElements} />
      <FaviconLink favicon={page.meta?.favicon} />
      <FaviconSetLinks favicons={normalizedFavicons} />
      <CustomStylesheet stylesheet={page.meta?.stylesheet} />
      <GoogleFonts googleFonts={page.meta?.googleFonts} />
      <ThemeFonts theme={theme} />
      <GlobalStyles
        directionStyles={directionStyles}
        cssHref={props.cssHref}
      />
      <HeadScripts scripts={scripts} />
    </>
  )
}
