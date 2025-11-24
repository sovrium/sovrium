/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { extractBlockMetaFromSections } from '@/presentation/components/metadata/extract-block-meta'
import { PageBodyScripts } from '@/presentation/components/pages/PageBodyScripts'
import { PageHead } from '@/presentation/components/pages/PageHead'
import { resolvePageLanguage } from '@/presentation/components/pages/PageLangResolver'
import { PageLayout } from '@/presentation/components/pages/PageLayout'
import { PageMain } from '@/presentation/components/pages/PageMain'
import { extractPageMetadata } from '@/presentation/components/pages/PageMetadata'
import { groupScriptsByPosition } from '@/presentation/components/pages/PageScripts'
import type { Blocks } from '@/domain/models/app/blocks'
import type { Languages } from '@/domain/models/app/languages'
import type { Layout } from '@/domain/models/app/page/layout'
import type { Page } from '@/domain/models/app/pages'
import type { Theme } from '@/domain/models/app/theme'
import type { RouteParams } from '@/domain/utils/route-matcher'

type DynamicPageProps = {
  readonly page: Page
  readonly blocks?: Blocks
  readonly theme?: Theme
  readonly languages?: Languages
  readonly defaultLayout?: Layout
  readonly detectedLanguage?: string
  readonly routeParams?: RouteParams
}

type DynamicPageHeadProps = {
  readonly mergedPage: Page
  readonly theme?: Theme
  readonly directionStyles: string
  readonly title: string
  readonly description: string
  readonly keywords?: string
  readonly canonical?: string
  readonly lang: string
  readonly languages?: Languages
  readonly scripts: ReturnType<typeof groupScriptsByPosition>
}

/**
 * Merges block metadata with page metadata
 *
 * @param page - Page configuration
 * @param blocks - Available blocks
 * @returns Page with merged metadata
 */
function mergeBlockMetaIntoPage(page: Page, blocks?: Blocks): Page {
  const blockOpenGraph = extractBlockMetaFromSections(page.sections, blocks)

  if (!blockOpenGraph || !page.meta) return page

  return {
    ...page,
    meta: {
      ...page.meta,
      openGraph: {
        ...page.meta.openGraph,
        ...blockOpenGraph,
      },
    },
  }
}

/**
 * Renders the <head> section of DynamicPage
 * Extracted to satisfy max-lines-per-function ESLint rule
 */
function DynamicPageHead({
  mergedPage,
  theme,
  directionStyles,
  title,
  description,
  keywords,
  canonical,
  lang,
  languages,
  scripts,
}: DynamicPageHeadProps): Readonly<ReactElement> {
  return (
    <head>
      <PageHead
        page={mergedPage}
        theme={theme}
        directionStyles={directionStyles}
        title={title}
        description={description}
        keywords={keywords}
        canonical={canonical}
        lang={lang}
        languages={languages}
        scripts={scripts}
      />
    </head>
  )
}

type DynamicPageBodyProps = {
  readonly page: Page
  readonly blocks?: Blocks
  readonly theme?: Theme
  readonly languages?: Languages
  readonly defaultLayout?: Layout
  readonly direction: 'ltr' | 'rtl'
  readonly scripts: ReturnType<typeof groupScriptsByPosition>
  readonly lang: string
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
  readonly routeParams?: RouteParams
}

/**
 * Generic parameter names that require context from path segments
 * These parameters get prefixed with their context (e.g., product-id, user-key)
 */
const GENERIC_PARAM_NAMES = new Set(['id', 'key', 'uid', 'pk'])

/**
 * Converts route parameters to data attributes for testing
 * Uses context-aware naming: generic params (id, key) get prefixed, descriptive ones (slug) don't
 *
 * @param routeParams - Route parameters extracted from URL
 * @param path - Page path pattern (e.g., '/blog/:slug')
 * @returns Data attributes object
 */
function buildDataAttributes(
  routeParams: RouteParams | undefined,
  path: string | undefined
): Record<string, string> {
  if (!routeParams || !path) {
    return {}
  }

  const pathSegments = path.split('/').filter(Boolean)

  return Object.entries(routeParams).reduce<Record<string, string>>((acc, [key, value]) => {
    // Check if parameter name is generic and needs context
    if (GENERIC_PARAM_NAMES.has(key)) {
      // Generic parameter - add context from previous path segment
      // e.g., /products/:id -> data-product-id
      const paramIndex = pathSegments.findIndex((seg) => seg === `:${key}`)
      if (paramIndex > 0) {
        const contextSegment = pathSegments[paramIndex - 1]
        if (!contextSegment) {
          return { ...acc, [`data-${key}`]: value }
        }
        // Convert plural to singular (e.g., 'products' -> 'product')
        const singularContext = contextSegment.endsWith('s')
          ? contextSegment.slice(0, -1)
          : contextSegment
        return { ...acc, [`data-${singularContext}-${key}`]: value }
      }
      // No context available, use parameter name only
      return { ...acc, [`data-${key}`]: value }
    }
    // Descriptive parameter - use as-is (e.g., /blog/:slug -> data-slug)
    return { ...acc, [`data-${key}`]: value }
  }, {})
}

/**
 * Renders the <body> section of DynamicPage
 * Extracted to satisfy max-lines-per-function ESLint rule
 */
function DynamicPageBody({
  page,
  blocks,
  theme,
  languages,
  defaultLayout,
  direction,
  scripts,
  lang,
  bodyStyle,
  routeParams,
}: DynamicPageBodyProps): Readonly<ReactElement> {
  const dataAttributes = buildDataAttributes(routeParams, page.path)

  return (
    <body
      {...(bodyStyle && { style: bodyStyle })}
      {...dataAttributes}
    >
      <PageBodyScripts
        page={page}
        theme={theme}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="start"
      />
      <PageLayout
        page={page}
        defaultLayout={defaultLayout}
      >
        <PageMain
          page={page}
          sections={page.sections}
          theme={theme}
          blocks={blocks}
          languages={languages}
          currentLang={lang}
        />
      </PageLayout>
      <PageBodyScripts
        page={page}
        theme={theme}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="end"
      />
    </body>
  )
}

/**
 * Renders a page from configuration as a complete HTML document
 * Theme CSS is compiled globally at server startup via /assets/output.css
 * Theme is still passed for font URLs, animation flags, and debugging
 */
export function DynamicPage({
  page,
  blocks,
  theme,
  languages,
  defaultLayout,
  detectedLanguage,
  routeParams,
}: DynamicPageProps): Readonly<ReactElement> {
  const metadata = extractPageMetadata(page, theme, languages, detectedLanguage)
  const langConfig = resolvePageLanguage(page, languages, detectedLanguage)
  const scripts = groupScriptsByPosition(page)
  const pageWithMeta = mergeBlockMetaIntoPage(page, blocks)

  // Build data-features attribute if features are configured
  const dataFeaturesAttr = page.scripts?.features
    ? { 'data-features': JSON.stringify(page.scripts.features) }
    : {}

  return (
    <html
      lang={langConfig.lang}
      dir={langConfig.direction}
      {...dataFeaturesAttr}
    >
      <DynamicPageHead
        mergedPage={pageWithMeta}
        theme={theme}
        directionStyles={langConfig.directionStyles}
        title={metadata.title}
        description={metadata.description}
        keywords={metadata.keywords}
        canonical={metadata.canonical}
        lang={langConfig.lang}
        languages={languages}
        scripts={scripts}
      />
      <DynamicPageBody
        page={page}
        blocks={blocks}
        theme={theme}
        languages={languages}
        defaultLayout={defaultLayout}
        direction={langConfig.direction}
        scripts={scripts}
        lang={langConfig.lang}
        bodyStyle={metadata.bodyStyle}
        routeParams={routeParams}
      />
    </html>
  )
}
