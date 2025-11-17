/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveTranslationPattern } from '@/presentation/translations/translation-resolver'
import { buildProviderElements } from './analytics-builders'
import { buildCustomElement } from './custom-elements-builders'
import type { Languages } from '@/domain/models/app/languages'
import type { Analytics } from '@/domain/models/app/page/meta/analytics'
import type { CustomElements } from '@/domain/models/app/page/meta/custom-elements'
import type { FaviconSet } from '@/domain/models/app/page/meta/favicon-set'
import type { OpenGraph } from '@/domain/models/app/page/meta/open-graph'
import type { Preload } from '@/domain/models/app/page/meta/preload'
import type { Page } from '@/domain/models/app/pages'

/**
 * Render Open Graph metadata tags
 * Generates <meta property="og:*"> tags for Facebook/LinkedIn sharing
 *
 * @param openGraph - Open Graph configuration from page.meta
 * @param lang - Current language code for translation resolution
 * @param languages - Languages configuration for translation resolution
 * @returns React fragment with OG meta tags
 */
export function OpenGraphMeta({
  openGraph,
  lang,
  languages,
}: {
  readonly openGraph?: OpenGraph
  readonly lang?: string
  readonly languages?: Languages
}): Readonly<ReactElement | undefined> {
  if (!openGraph) {
    return undefined
  }

  // Resolve translation patterns in OpenGraph fields
  const resolveValue = (value: string | undefined): string | undefined => {
    if (!value || !lang) return value
    return resolveTranslationPattern(value, lang, languages)
  }

  const fields: ReadonlyArray<{ readonly key: string; readonly value?: string }> = [
    { key: 'title', value: resolveValue(openGraph.title) },
    { key: 'description', value: resolveValue(openGraph.description) },
    { key: 'image', value: openGraph.image },
    { key: 'image:alt', value: resolveValue(openGraph.imageAlt) },
    { key: 'url', value: openGraph.url },
    { key: 'type', value: openGraph.type },
    { key: 'site_name', value: resolveValue(openGraph.siteName) },
    { key: 'locale', value: openGraph.locale },
    { key: 'determiner', value: openGraph.determiner },
    { key: 'video', value: openGraph.video },
    { key: 'audio', value: openGraph.audio },
  ]

  return (
    <>
      {fields.map(
        ({ key, value }) =>
          value && (
            <meta
              key={key}
              property={`og:${key}`}
              content={value}
            />
          )
      )}
    </>
  )
}

/**
 * Render Twitter Card metadata tags
 * Generates <meta name="twitter:*"> tags for Twitter/X sharing
 * Supports both 'twitter' and 'twitterCard' field names for compatibility
 *
 * @param page - Page configuration
 * @returns React fragment with Twitter meta tags
 */
export function TwitterCardMeta({
  page,
}: {
  readonly page: Page
}): Readonly<ReactElement | undefined> {
  // Support both 'twitter' (canonical) and 'twitterCard' (test alias)
  const twitterCard = page.meta?.twitter || page.meta?.twitterCard
  if (!twitterCard) {
    return undefined
  }

  const fields: ReadonlyArray<{ readonly key: string; readonly value?: string }> = [
    { key: 'card', value: twitterCard.card },
    { key: 'title', value: twitterCard.title },
    { key: 'description', value: twitterCard.description },
    { key: 'image', value: twitterCard.image },
  ]

  return (
    <>
      {fields.map(
        ({ key, value }) =>
          value && (
            <meta
              key={key}
              name={`twitter:${key}`}
              content={value}
            />
          )
      )}
    </>
  )
}

/**
 * Render structured data as JSON-LD script tags
 * Generates Schema.org structured data for rich search results
 * Supports both 'schema' (canonical) and 'structuredData' (test alias)
 *
 * Handles two formats:
 * 1. Direct Schema.org object: { "@context": "...", "@type": "...", ... }
 * 2. Orchestrator schema: { organization: {...}, faqPage: {...}, ... }
 *
 * Each structured data type is rendered as a separate <script type="application/ld+json">
 * tag for proper Schema.org validation
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Schema.org structured data (JSON.stringify)
 * - Source: Validated Page schema (page.meta.schema or page.meta.structuredData)
 * - Risk: None - JSON data cannot execute as code
 * - Validation: Schema validation ensures correct structure
 * - Purpose: Generate rich search results (SEO)
 * - XSS Protection: type="application/ld+json" prevents script execution
 * - Format: Safe serialization via JSON.stringify
 *
 * @param page - Page configuration
 * @returns React fragment with script tags or undefined
 */
export function StructuredDataScript({
  page,
}: {
  readonly page: Page
}): Readonly<ReactElement | undefined> {
  // Support both 'schema' (canonical) and 'structuredData' (test alias)
  const structuredData = page.meta?.schema || page.meta?.structuredData
  if (!structuredData) {
    return undefined
  }

  // Type guard: ensure structuredData is an object
  if (typeof structuredData !== 'object' || structuredData === null) {
    return undefined
  }

  // Check if this is a direct Schema.org object (has @context and @type)
  const isDirectSchemaObject =
    '@context' in structuredData && '@type' in structuredData

  // Handle direct Schema.org object format
  if (isDirectSchemaObject) {
    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
    )
  }

  // Handle orchestrator schema format (organization, faqPage, etc.)
  const structuredDataTypes = Object.entries(structuredData).filter(
    ([, value]) => value !== undefined && value !== null
  )

  if (structuredDataTypes.length === 0) {
    return undefined
  }

  return (
    <>
      {structuredDataTypes.map(([key, value]) => (
        <script
          key={key}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(value),
          }}
        />
      ))}
    </>
  )
}

/**
 * Render analytics provider scripts and configuration in HEAD section
 * Generates DNS prefetch, external scripts with data-testid, and initialization scripts
 *
 * @param analytics - Analytics configuration from page.meta (union type)
 * @returns React fragment with head elements
 */
export function AnalyticsHead({
  analytics,
}: {
  readonly analytics?: Analytics | { readonly [x: string]: unknown }
}): Readonly<ReactElement | undefined> {
  // Type guard: ensure analytics has providers array (not generic record)
  if (
    !analytics ||
    !('providers' in analytics) ||
    !Array.isArray(analytics.providers) ||
    analytics.providers.length === 0
  ) {
    return undefined
  }

  // Type assertion: after type guard, we know analytics has providers array
  const analyticsConfig = analytics as Analytics

  // Render all providers using builder pattern
  return <>{analyticsConfig.providers.flatMap(buildProviderElements)}</>
}

/**
 * Render DNS prefetch link tags
 * Generates <link rel="dns-prefetch" href="..."> tags for external domains
 *
 * @param dnsPrefetch - DNS prefetch configuration from page.meta
 * @returns React fragment with DNS prefetch link tags
 */
export function DnsPrefetchLinks({
  dnsPrefetch,
}: {
  readonly dnsPrefetch?: ReadonlyArray<string>
}): Readonly<ReactElement | undefined> {
  if (!dnsPrefetch || dnsPrefetch.length === 0) {
    return undefined
  }

  return (
    <>
      {dnsPrefetch.map((domain) => (
        <link
          key={domain}
          rel="dns-prefetch"
          href={domain}
        />
      ))}
    </>
  )
}

/**
 * Render custom head elements
 * Generates arbitrary HTML elements (meta, link, script, style, base) in <head>
 *
 * @param customElements - Custom elements configuration from page.meta
 * @returns React fragment with custom head elements
 */
export function CustomElementsHead({
  customElements,
}: {
  readonly customElements?: CustomElements
}): Readonly<ReactElement | undefined> {
  if (!customElements || customElements.length === 0) {
    return undefined
  }

  return <>{customElements.map(buildCustomElement)}</>
}

/**
 * Render single favicon link tag
 * Generates simple <link rel="icon" href="..."> tag for default favicon
 *
 * @param favicon - Favicon path from page.meta.favicon
 * @returns React element with favicon link tag or undefined
 */
export function FaviconLink({
  favicon,
}: {
  readonly favicon?: string
}): Readonly<ReactElement | undefined> {
  if (!favicon) {
    return undefined
  }

  return (
    <link
      rel="icon"
      href={favicon}
    />
  )
}

/**
 * Render favicon set link tags
 * Generates <link rel="..."> tags for multi-device favicon support
 *
 * Supports:
 * - icon: Standard browser favicon (16x16, 32x32)
 * - apple-touch-icon: iOS home screen icon (180x180)
 * - manifest: PWA manifest file reference
 * - mask-icon: Safari pinned tab icon (monochrome SVG with color)
 *
 * @param favicons - Favicon set configuration from page.meta
 * @returns React fragment with favicon link tags
 */
export function FaviconSetLinks({
  favicons,
}: {
  readonly favicons?: FaviconSet
}): Readonly<ReactElement | undefined> {
  if (!favicons || favicons.length === 0) {
    return undefined
  }

  return (
    <>
      {favicons.map((favicon, index) => {
        // Convert relative path (./favicon.png) to absolute path (/favicon.png)
        // Remove the leading ./ to make it an absolute path from the root
        const href = favicon.href.replace(/^\.\//, '/')

        return (
          <link
            key={index}
            rel={favicon.rel}
            href={href}
            {...(favicon.type && { type: favicon.type })}
            {...(favicon.sizes && { sizes: favicon.sizes })}
            {...(favicon.color && { color: favicon.color })}
          />
        )
      })}
    </>
  )
}

/**
 * Render preload link tags
 * Generates <link rel="preload" ...> tags for critical resources
 *
 * @param preload - Preload configuration from page.meta
 * @returns React fragment with preload link tags
 */
export function PreloadLinks({
  preload,
}: {
  readonly preload?: Preload
}): Readonly<ReactElement | undefined> {
  if (!preload || preload.length === 0) {
    return undefined
  }

  return (
    <>
      {preload.map((item, index) => (
        <link
          key={index}
          rel="preload"
          href={item.href}
          as={item.as}
          {...(item.type && { type: item.type })}
          {...(item.crossorigin !== undefined &&
            (typeof item.crossorigin === 'boolean'
              ? item.crossorigin && { crossOrigin: 'anonymous' }
              : { crossOrigin: item.crossorigin }))}
          {...(item.media && { media: item.media })}
        />
      ))}
    </>
  )
}
