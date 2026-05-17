/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines, max-lines-per-function -- SSR page renderer with head/body/scripts orchestration */

import { type ReactElement } from 'react'
import { extractComponentMetaFromSections } from '@/presentation/ui/metadata/extract-component-meta'
import { PageBodyScripts } from '@/presentation/ui/pages/PageBodyScripts'
import { PageHead } from '@/presentation/ui/pages/PageHead'
import { resolvePageLanguage } from '@/presentation/ui/pages/PageLangResolver'
import { PageMain } from '@/presentation/ui/pages/PageMain'
import { extractPageMetadata } from '@/presentation/ui/pages/PageMetadata'
import { groupScriptsByPosition } from '@/presentation/ui/pages/PageScripts'
import { PageSidebar } from '@/presentation/ui/pages/PageSidebar'
import { ISLAND_COMPONENT_TYPES } from '@/presentation/utils/island-component-types'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { RouteParams } from '@/domain/utils/route-matcher'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'
import type { ResolvedSidebarSection } from '@/presentation/rendering/sidebar-resolver'

type DynamicPageProps = {
  readonly page: Page
  readonly components?: Components
  readonly theme?: Theme
  readonly languages?: Languages
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly detectedLanguage?: string
  readonly routeParams?: RouteParams
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
  /** Hashed filename of the island entry bundle (e.g., "island-client-a7f3b2.js") */
  readonly islandEntryFile?: string
  /** Pre-resolved sidebar sections (US-PAGES-ACCESS-SCOPED-SIDEBAR). */
  readonly resolvedSidebar?: readonly ResolvedSidebarSection[]
  /** Pre-rendered markdown payload (US-PAGES-LAYOUT-MARKDOWN-PAGES-002). */
  readonly markdownPayload?: ResolvedMarkdownPage
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
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
}

/**
 * Checks if a single component (or any of its descendants) requires the
 * React island runtime. Recursively descends into `children` so nested
 * data-tables and other islands are detected when wrapped in containers.
 */
const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

function itemSelfNeedsIslands(item: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(item.type)) return true
  if (item.dataSource?.mode === 'search') return true
  const action = (item as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

function itemNeedsIslands(item: Component): boolean {
  if (itemSelfNeedsIslands(item)) return true
  const { children } = item as { readonly children?: ReadonlyArray<Component | string> }
  if (!children || children.length === 0) return false
  return children.some((child) => {
    if (typeof child === 'string') return false
    if ('component' in child || '$ref' in child) return false
    return itemNeedsIslands(child as Component)
  })
}

/**
 * Checks if a page has components that require the React island runtime.
 *
 * Island components are rendered as placeholders on the server and
 * hydrated with interactive React components on the client.
 * Also detects list components in search mode, which use the search-list island.
 */
function hasIslandComponents(page: Page): boolean {
  if (!page.components || page.components.length === 0) return false
  return page.components.some((item) => {
    if ('component' in item || '$ref' in item) return false
    return itemNeedsIslands(item as Component)
  })
}

/**
 * Checks if a page has interactive features that require the client runtime
 *
 * Returns true if the page has components with action types (auth, crud, filter),
 * modal components, or interactive patterns like dropdowns and search.
 */
function hasInteractiveFeatures(page: Page): boolean {
  if (!page.components || page.components.length === 0) return false

  // Check for interactive component types or action properties
  const interactiveTypes = new Set(['form', 'modal', 'data-table', 'dropdown'])

  return page.components.some((item) => {
    if (interactiveTypes.has(item.type)) return true
    const itemWithAction = item as Record<string, unknown>
    if (itemWithAction['action']) return true
    const props = item.props as Record<string, unknown> | undefined
    return !!(props?.action || props?.interactions)
  })
}

/**
 * Merges component metadata with page metadata
 *
 * @param page - Page configuration
 * @param components - Available component templates
 * @returns Page with merged metadata
 */
function mergeComponentMetaIntoPage(page: Page, components?: Components): Page {
  const componentOpenGraph = extractComponentMetaFromSections(page.components, components)

  if (!componentOpenGraph || !page.meta) return page

  return {
    ...page,
    meta: {
      ...page.meta,
      openGraph: {
        ...page.meta.openGraph,
        ...componentOpenGraph,
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
  builtInAnalyticsEnabled,
  builtInAnalyticsSessionTimeout,
}: DynamicPageHeadProps): Readonly<ReactElement> {
  // Inline analytics script if enabled (contains /api/analytics/collect endpoint)
  const analyticsScript = builtInAnalyticsEnabled
    ? `(function(){
"use strict";
var E="/api/analytics/collect",A="${mergedPage.name || 'app'}",D=true,sessionTimeout=${builtInAnalyticsSessionTimeout ?? 30};
if(D&&navigator.doNotTrack==="1")return;
var u=function(){
try{var s=new URLSearchParams(location.search);
var d={p:location.pathname,t:document.title,r:document.referrer||void 0,
sw:screen.width,sh:screen.height,
us:s.get("utm_source")||void 0,um:s.get("utm_medium")||void 0,
uc:s.get("utm_campaign")||void 0,ux:s.get("utm_content")||void 0,
ut:s.get("utm_term")||void 0};
var b=JSON.stringify(d);
if(navigator.sendBeacon){navigator.sendBeacon(E,new Blob([b],{type:"application/json"}))}
else{var x=new XMLHttpRequest();x.open("POST",E,true);x.setRequestHeader("Content-Type","application/json");x.send(b)}
}catch(e){}};
u();
var op=history.pushState;
history.pushState=function(){op.apply(this,arguments);u()};
window.addEventListener("popstate",u);
})();`
    : undefined

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
      {analyticsScript && (
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- SSR-only <script> element; never re-renders client-side
        <script dangerouslySetInnerHTML={{ __html: analyticsScript }} />
      )}
    </head>
  )
}

type DynamicPageBodyProps = {
  readonly page: Page
  readonly components?: Components
  readonly theme?: Theme
  readonly languages?: Languages
  readonly tables?: Tables
  readonly buckets?: Buckets
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
  readonly islandEntryFile?: string
  readonly resolvedSidebar?: readonly ResolvedSidebarSection[]
  readonly markdownPayload?: ResolvedMarkdownPage
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

/** Stable identity for the toast container's flex stack to satisfy react-perf. */
const TOAST_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: '1px',
} as const

/**
 * Returns the resolved sidebar sections only when the page actually
 * declares a sidebar AND the resolver produced at least one section.
 *
 * Extracted to keep `DynamicPageBody`'s cyclomatic complexity under
 * the project limit (`eslint/size-limits.config.ts`: complexity 10).
 */
function selectSidebarSections(
  resolvedSidebar: readonly ResolvedSidebarSection[] | undefined,
  page: Page
): readonly ResolvedSidebarSection[] | undefined {
  if (resolvedSidebar === undefined || resolvedSidebar.length === 0) return undefined
  if (page.layout?.sidebar === undefined) return undefined
  return resolvedSidebar
}

/**
 * Renders the toast container element when page.toasts is configured.
 */
function PageToastContainer({
  toasts,
}: {
  readonly toasts: NonNullable<DynamicPageBodyProps['page']['toasts']>
}): Readonly<ReactElement> {
  return (
    <div
      data-sonner-toaster=""
      role="status"
      aria-live="polite"
      {...(toasts.position !== undefined && { 'data-position': toasts.position })}
      style={TOAST_CONTAINER_STYLE}
    />
  )
}

/**
 * Renders the <body> section of DynamicPage
 * Extracted to satisfy max-lines-per-function ESLint rule
 */
function DynamicPageBody({
  page,
  components,
  theme,
  languages,
  tables,
  buckets,
  direction,
  scripts,
  lang,
  bodyStyle,
  routeParams,
  islandEntryFile,
  resolvedSidebar,
  markdownPayload,
}: DynamicPageBodyProps): Readonly<ReactElement> {
  const dataAttributes = buildDataAttributes(routeParams, page.path)
  const sidebarSections = selectSidebarSections(resolvedSidebar, page)

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
      {sidebarSections && <PageSidebar sections={sidebarSections} />}
      <PageMain
        page={page}
        pageComponents={page.components}
        theme={theme}
        components={components}
        languages={languages}
        currentLang={lang}
        tables={tables}
        buckets={buckets}
        routeParams={routeParams}
        markdownPayload={markdownPayload}
      />
      {page.toasts && <PageToastContainer toasts={page.toasts} />}
      <PageBodyScripts
        page={page}
        theme={theme}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="end"
      />
      {hasInteractiveFeatures(page) && (
        <script
          src="/assets/client.js"
          defer={true}
        />
      )}
      {hasIslandComponents(page) && islandEntryFile && (
        <script
          src={`/assets/islands/${islandEntryFile}`}
          type="module"
        />
      )}
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
  components,
  theme,
  languages,
  tables,
  buckets,
  detectedLanguage,
  routeParams,
  builtInAnalyticsEnabled,
  builtInAnalyticsSessionTimeout,
  islandEntryFile,
  resolvedSidebar,
  markdownPayload,
}: DynamicPageProps): Readonly<ReactElement> {
  const metadata = extractPageMetadata(page, theme, languages, detectedLanguage)
  const langConfig = resolvePageLanguage(page, languages, detectedLanguage)
  const scripts = groupScriptsByPosition(page)
  const pageWithMeta = mergeComponentMetaIntoPage(page, components)

  return (
    <html
      lang={langConfig.lang}
      dir={langConfig.direction}
      {...(page.scripts && { 'data-features': JSON.stringify(page.scripts.features || {}) })}
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
        builtInAnalyticsEnabled={builtInAnalyticsEnabled}
        builtInAnalyticsSessionTimeout={builtInAnalyticsSessionTimeout}
      />
      <DynamicPageBody
        page={page}
        components={components}
        theme={theme}
        languages={languages}
        tables={tables}
        buckets={buckets}
        direction={langConfig.direction}
        scripts={scripts}
        lang={langConfig.lang}
        bodyStyle={metadata.bodyStyle}
        routeParams={routeParams}
        islandEntryFile={islandEntryFile}
        resolvedSidebar={resolvedSidebar}
        markdownPayload={markdownPayload}
      />
    </html>
  )
}
