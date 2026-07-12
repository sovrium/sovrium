/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { extractComponentMetaFromSections } from '@/presentation/ui/metadata/extract-component-meta'
import {
  COMMAND_PALETTE_CAPTURE_SCRIPT,
  hasCommandPaletteHost,
} from '@/presentation/ui/pages/CommandPaletteCapture'
import { PageBodyScripts } from '@/presentation/ui/pages/PageBodyScripts'
import { PageHead } from '@/presentation/ui/pages/PageHead'
import { resolvePageLanguage } from '@/presentation/ui/pages/PageLangResolver'
import { PageMain } from '@/presentation/ui/pages/PageMain'
import { extractPageMetadata } from '@/presentation/ui/pages/PageMetadata'
import { groupScriptsByPosition } from '@/presentation/ui/pages/PageScripts'
import { PageSidebar } from '@/presentation/ui/pages/PageSidebar'
import { ISLAND_COMPONENT_TYPES } from '@/presentation/utils/island-component-types'
import { isListIslandMode } from '@/presentation/utils/list-island-mode'
import { isRecordFieldSystemMode } from '@/presentation/utils/system-detail-mode'
import type { Buckets } from '@/domain/models/app/buckets'
import type { Components } from '@/domain/models/app/components'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'
import type { Theme } from '@/domain/models/app/theme'
import type { SessionInfo } from '@/domain/types/session-info'
import type { RouteParams } from '@/domain/utils/matching/route-matcher'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'
import type { ResolvedSidebarSection } from '@/presentation/rendering/sidebar-resolver'

type DynamicPageProps = {
  readonly page: Page
  readonly components?: Components
  readonly theme?: Theme
  readonly languages?: Languages
  readonly tables?: Tables
  readonly buckets?: Buckets
  readonly landingPath?: string
  readonly detectedLanguage?: string
  readonly routeParams?: RouteParams
  readonly builtInAnalyticsEnabled?: boolean
  readonly builtInAnalyticsSessionTimeout?: number
  readonly islandEntryFile?: string
  readonly resolvedSidebar?: readonly ResolvedSidebarSection[]
  readonly markdownPayload?: ResolvedMarkdownPage
  readonly session?: SessionInfo
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
  readonly contentDirSeo?: ResolvedMarkdownPage['seo']
}

const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

function isSingleRecordBoundForm(item: Component): boolean {
  return (
    (item.type === 'form' || item.type === 'data-form') &&
    item.dataSource?.mode === 'single' &&
    typeof item.dataSource.table === 'string'
  )
}

function hasDataIslandProp(item: Component): boolean {
  const props = (item as Record<string, unknown>).props as Record<string, unknown> | undefined
  return typeof props?.['data-island'] === 'string'
}

function itemSelfNeedsIslands(item: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(item.type)) return true
  if (hasDataIslandProp(item)) return true
  if (item.dataSource?.mode === 'search') return true
  if (isListIslandMode(item)) return true
  if (isRecordFieldSystemMode(item)) return true
  if (isSingleRecordBoundForm(item)) return true
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

function hasIslandComponents(page: Page): boolean {
  if (page.presence === true) return true
  if (!page.components || page.components.length === 0) return false
  return page.components.some((item) => {
    if ('component' in item || '$ref' in item) return false
    return itemNeedsIslands(item as Component)
  })
}

const INTERACTIVE_COMPONENT_TYPES = new Set(['form', 'modal', 'data-table', 'dropdown'])

function componentIsSessionBound(record: Record<string, unknown>): boolean {
  if (typeof record['session'] === 'string') return true
  const { content } = record
  return typeof content === 'string' && content.includes('$session.')
}

function componentSelfIsInteractive(record: Record<string, unknown>): boolean {
  const { type } = record
  if (typeof type === 'string' && INTERACTIVE_COMPONENT_TYPES.has(type)) return true
  if (record['action']) return true
  if (componentIsSessionBound(record)) return true
  const props = record['props'] as Record<string, unknown> | undefined
  return Boolean(props?.['action'] || props?.['interactions'])
}

function componentIsInteractive(item: unknown): boolean {
  if (item === null || typeof item !== 'object') return false
  const record = item as Record<string, unknown>
  if (componentSelfIsInteractive(record)) return true
  const { children } = record
  return Array.isArray(children) && children.some((child) => componentIsInteractive(child))
}

function hasInteractiveFeatures(page: Page): boolean {
  if (!page.components || page.components.length === 0) return false
  return page.components.some((item) => componentIsInteractive(item))
}

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
  contentDirSeo,
}: DynamicPageHeadProps): Readonly<ReactElement> {
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
      {}
      {hasCommandPaletteHost(mergedPage.components) && (
        <script dangerouslySetInnerHTML={{ __html: COMMAND_PALETTE_CAPTURE_SCRIPT }} />
      )}
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
        contentDirSeo={contentDirSeo}
      />
      {analyticsScript && (
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
  readonly landingPath?: string
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
  readonly session?: SessionInfo
}

const GENERIC_PARAM_NAMES = new Set(['id', 'key', 'uid', 'pk'])

function buildDataAttributes(
  routeParams: RouteParams | undefined,
  path: string | undefined
): Record<string, string> {
  if (!routeParams || !path) {
    return {}
  }

  const pathSegments = path.split('/').filter(Boolean)

  return Object.entries(routeParams).reduce<Record<string, string>>((acc, [key, value]) => {
    if (GENERIC_PARAM_NAMES.has(key)) {
      const paramIndex = pathSegments.findIndex((seg) => seg === `:${key}`)
      if (paramIndex > 0) {
        const contextSegment = pathSegments[paramIndex - 1]
        if (!contextSegment) {
          return { ...acc, [`data-${key}`]: value }
        }
        const singularContext = contextSegment.endsWith('s')
          ? contextSegment.slice(0, -1)
          : contextSegment
        return { ...acc, [`data-${singularContext}-${key}`]: value }
      }
      return { ...acc, [`data-${key}`]: value }
    }
    return { ...acc, [`data-${key}`]: value }
  }, {})
}

const TOAST_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: '1px',
} as const

const PRESENCE_CONTAINER_STYLE = { minHeight: '1px' } as const

function PresenceIndicatorMount({ page }: { readonly page: Page }): Readonly<ReactElement> {
  const islandProps = JSON.stringify({ pagePath: page.path })
  return (
    <div
      data-island="presence-indicator"
      data-island-props={islandProps}
      style={PRESENCE_CONTAINER_STYLE}
    >
      <div
        data-testid="presence-indicator"
        aria-label="Users viewing this page"
      />
    </div>
  )
}

function selectSidebarSections(
  resolvedSidebar: readonly ResolvedSidebarSection[] | undefined,
  page: Page
): readonly ResolvedSidebarSection[] | undefined {
  if (resolvedSidebar === undefined || resolvedSidebar.length === 0) return undefined
  if (page.layout?.sidebar === undefined) return undefined
  return resolvedSidebar
}

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

function DynamicPageBody({
  page,
  components,
  theme,
  languages,
  tables,
  buckets,
  landingPath,
  direction,
  scripts,
  lang,
  bodyStyle,
  routeParams,
  islandEntryFile,
  resolvedSidebar,
  markdownPayload,
  session,
}: DynamicPageBodyProps): Readonly<ReactElement> {
  const dataAttributes = buildDataAttributes(routeParams, page.path)
  const sidebarSections = selectSidebarSections(resolvedSidebar, page)

  return (
    <body
      {...(bodyStyle && { style: bodyStyle })}
      {...dataAttributes}
    >
      {}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-50 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
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
        landingPath={landingPath}
        routeParams={routeParams}
        session={session}
        markdownPayload={markdownPayload}
      />
      {page.presence === true && <PresenceIndicatorMount page={page} />}
      {page.toasts && <PageToastContainer toasts={page.toasts} />}
      <PageBodyScripts
        page={page}
        theme={theme}
        languages={languages}
        direction={direction}
        scripts={scripts}
        position="end"
        frontmatter={markdownPayload?.frontmatter}
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

export function DynamicPage({
  page,
  components,
  theme,
  languages,
  tables,
  buckets,
  landingPath,
  detectedLanguage,
  routeParams,
  builtInAnalyticsEnabled,
  builtInAnalyticsSessionTimeout,
  islandEntryFile,
  resolvedSidebar,
  markdownPayload,
  session,
}: DynamicPageProps): Readonly<ReactElement> {
  const metadata = extractPageMetadata(page, theme, languages, {
    detectedLanguage,
    frontmatter: markdownPayload?.frontmatter,
  })
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
        contentDirSeo={markdownPayload?.seo}
      />
      <DynamicPageBody
        page={page}
        components={components}
        theme={theme}
        languages={languages}
        tables={tables}
        buckets={buckets}
        landingPath={landingPath}
        direction={langConfig.direction}
        scripts={scripts}
        lang={langConfig.lang}
        bodyStyle={metadata.bodyStyle}
        routeParams={routeParams}
        islandEntryFile={islandEntryFile}
        resolvedSidebar={resolvedSidebar}
        markdownPayload={markdownPayload}
        session={session}
      />
    </html>
  )
}
