/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { normalizeFavicons } from '@/application/metadata/favicon-transformer'
import {
  AnalyticsHead,
  CustomElementsHead,
  DnsPrefetchLinks,
  FaviconSetLinks,
  OpenGraphMeta,
  StructuredDataScript,
  TwitterCardMeta,
} from '@/presentation/components/metadata'
import { renderInlineScriptTag, renderScriptTag } from '@/presentation/scripts/script-renderers'
import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import type { GroupedScripts } from './PageScripts'
import type { Languages } from '@/domain/models/app/languages'
import type { CustomElement } from '@/domain/models/app/page/meta/custom-elements'
import type { OpenGraph } from '@/domain/models/app/page/meta/open-graph'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'

/**
 * Props for PageHead component
 */
type PageHeadProps = {
  readonly page: Page
  readonly theme: Theme | undefined
  readonly directionStyles: string
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly lang: string
  readonly languages?: Languages
  readonly scripts: GroupedScripts
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
 * Renders basic meta tags (charset, viewport, title, description, keywords, canonical)
 */
function BasicMetaTags({
  title,
  description,
  keywords,
  canonical,
  hasCustomViewport,
}: {
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
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
function GlobalStyles({ directionStyles }: { readonly directionStyles: string }): ReactElement {
  return (
    <>
      <link
        rel="stylesheet"
        href="/assets/output.css"
      />
      <style dangerouslySetInnerHTML={{ __html: directionStyles }} />
    </>
  )
}

/**
 * Renders external and inline scripts for head section
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
 * Renders hreflang alternate links for multi-language SEO
 * Generates <link rel="alternate" hreflang="..."> tags for each supported language
 */
function HreflangLinks({
  page,
  languages,
}: {
  readonly page: Page
  readonly languages: Languages | undefined
}): ReactElement | undefined {
  if (!languages || languages.supported.length <= 1) {
    return undefined
  }

  const basePath = page.path === '/' ? '' : page.path

  return (
    <>
      {languages.supported.map((lang) => (
        <link
          key={lang.code}
          rel="alternate"
          hrefLang={lang.code}
          href={`/${lang.code}${basePath}/`}
        />
      ))}
      <link
        key="x-default"
        rel="alternate"
        hrefLang="x-default"
        href={`/${languages.default}${basePath}/`}
      />
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
export function PageHead({
  page,
  theme,
  directionStyles,
  title,
  description,
  keywords,
  canonical,
  lang,
  languages,
  scripts,
}: PageHeadProps): Readonly<ReactElement> {
  const hasCustomViewport = hasCustomViewportMeta(page.meta?.customElements)
  const openGraphData = extractOpenGraphData(page, lang, languages)
  const normalizedFavicons = normalizeFavicons(page.meta?.favicons)

  return (
    <>
      <BasicMetaTags
        title={title}
        description={description}
        keywords={keywords}
        canonical={canonical}
        hasCustomViewport={hasCustomViewport}
      />
      <OpenGraphMeta
        openGraph={openGraphData}
        lang={lang}
        languages={languages}
      />
      <TwitterCardMeta page={page} />
      <StructuredDataScript page={page} />
      <DnsPrefetchLinks dnsPrefetch={page.meta?.dnsPrefetch} />
      <HreflangLinks
        page={page}
        languages={languages}
      />
      <AnalyticsHead analytics={page.meta?.analytics} />
      <CustomElementsHead customElements={page.meta?.customElements} />
      {page.meta?.favicon && (
        <link
          rel="icon"
          href={page.meta.favicon}
        />
      )}
      <FaviconSetLinks favicons={normalizedFavicons} />
      <CustomStylesheet stylesheet={page.meta?.stylesheet} />
      <GoogleFonts googleFonts={page.meta?.googleFonts} />
      <ThemeFonts theme={theme} />
      <GlobalStyles directionStyles={directionStyles} />
      <HeadScripts scripts={scripts} />
    </>
  )
}
