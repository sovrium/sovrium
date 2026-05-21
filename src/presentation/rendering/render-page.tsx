/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { resolveLandingPath } from '@/domain/services/landing-resolver'
import { checkPageAccess, type AccessDecision } from '@/domain/services/page-access-check'
import { findMatchingRoute } from '@/domain/utils/route-matcher'
import {
  extractSessionTimeout,
  shouldInjectAnalytics,
} from '@/presentation/rendering/analytics-helpers'
import { resolveCustomHtmlSources } from '@/presentation/rendering/custom-html-resolver'
import { resolvePageDataSources } from '@/presentation/rendering/data-source-resolver'
import { expandFormRefs } from '@/presentation/rendering/forms/form-ref-resolver'
import { resolveMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'
import { resolveCollectionPage } from '@/presentation/rendering/page-collection-resolver'
import { resolvePageParentRecord } from '@/presentation/rendering/page-parent-resolver'
import { resolvePageSidebar } from '@/presentation/rendering/sidebar-resolver'
import { applyVisibilityToComponents } from '@/presentation/rendering/visibility-filter'
import { DefaultHomePage } from '@/presentation/ui/pages/DefaultHomePage'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import { ISLAND_COMPONENT_TYPES } from '@/presentation/utils/island-component-types'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SessionInfo } from '@/domain/types/session-info'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'
import type { ResolvedMarkdownPage } from '@/presentation/rendering/markdown-page-resolver'
import type { ResolvedSidebarSection } from '@/presentation/rendering/sidebar-resolver'

export interface IslandBuilder {
  readonly buildIslands: () => Promise<{ readonly entryFile: string }>
}

const noopDb: DataSourceDb = {
  fetchRecords: async () => [],
  countRecords: async () => 0,
  fetchSingleRecord: async () => undefined,
}


function stripAuthActionsIfUnconfigured(
  components: Page['components'],
  hasAuth: boolean
): Page['components'] {
  if (hasAuth || !components) return components

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    const component = item as Component
    if (component.action && 'type' in component.action && component.action.type === 'auth') {
      return hideComponent(component)
    }
    return component
  })
}

interface OAuthActionShape {
  readonly type: string
  readonly strategy?: string
  readonly provider?: string
}

function stripUnconfiguredOAuthForms(components: Page['components'], app: App): Page['components'] {
  if (!components) return components

  const oauthStrategy = app.auth?.strategies?.find((s) => s.type === 'oauth') as
    | { readonly type: 'oauth'; readonly providers: readonly string[] }
    | undefined
  const configuredProviders = oauthStrategy?.providers ?? []

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    const component = item as Component
    if (!component.action || !('type' in component.action)) return component

    const action = component.action as OAuthActionShape
    if (action.type !== 'auth' || action.strategy !== 'oauth') return component

    if (!action.provider || !configuredProviders.includes(action.provider)) {
      return hideComponent(component)
    }

    return component
  })
}

function isCrudCreateAllowed(
  tableName: string | undefined,
  tables: App['tables'],
  session: SessionInfo | undefined
): boolean {
  const table = tables?.find((t) => t.name === tableName)
  if (!table?.permissions?.create || table.permissions.create.length === 0) return true
  if (!session) return false
  return table.permissions.create.includes(session.role)
}

function hideComponent(component: Component): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      style: {
        ...((component.props?.style as Record<string, unknown> | undefined) ?? {}),
        display: 'none',
      },
    },
  }
}

function isCrudUpdateAllowed(
  tableName: string | undefined,
  tables: App['tables'],
  session: SessionInfo | undefined
): boolean {
  const table = tables?.find((t) => t.name === tableName)
  if (!table?.permissions?.update || table.permissions.update.length === 0) return true
  if (!session) return false
  return table.permissions.update.includes(session.role)
}

function applyCrudCreatePermissions(
  components: Page['components'],
  tables: App['tables'],
  session: SessionInfo | undefined
): Page['components'] {
  if (!components) return components

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item

    const component = item as Component
    const action = component.action as { type?: string; operation?: string; table?: string }

    if (action?.type !== 'crud' || action?.operation !== 'create') return component
    if (isCrudCreateAllowed(action.table, tables, session)) return component

    return hideComponent(component)
  })
}

function applyCrudUpdatePermissions(
  components: Page['components'],
  tables: App['tables'],
  session: SessionInfo | undefined
): Page['components'] {
  if (!components) return components

  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item

    const component = item as Component
    const action = component.action as { type?: string; operation?: string; table?: string }

    if (action?.type !== 'crud' || action?.operation !== 'update') return component
    if (isCrudUpdateAllowed(action.table, tables, session)) return component

    return hideComponent(component)
  })
}

const buildCommandPaletteComponent = (app: App): Component => {
  const navigablePages = (app.pages ?? [])
    .filter((page) => typeof page.path === 'string' && !page.path.includes(':'))
    .map((page) => ({
      name: page.name,
      path: page.path,
      title:
        typeof page.meta?.title === 'string' && page.meta.title.length > 0
          ? page.meta.title
          : page.name,
    }))
  return {
    type: 'command-palette',
    props: { pages: navigablePages },
  } as unknown as Component
}

function applyPageComponentFilters(
  rawPage: Page,
  app: App,
  session: SessionInfo | undefined,
  parentRecord: Readonly<Record<string, unknown>> | undefined
): Page {
  const authStripped = stripAuthActionsIfUnconfigured(rawPage.components, !!app.auth)
  const oauthFiltered = stripUnconfiguredOAuthForms(authStripped, app)
  const visibilityFiltered = applyVisibilityToComponents(oauthFiltered, session)
  const createPermFiltered = applyCrudCreatePermissions(visibilityFiltered, app.tables, session)
  const updatePermFiltered = applyCrudUpdatePermissions(createPermFiltered, app.tables, session)
  const expanded = expandFormRefs(updatePermFiltered, app, {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
  })
  return {
    ...rawPage,
    components: [...(expanded ?? []), buildCommandPaletteComponent(app)],
  }
}

const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

function selfNeedsIslands(s: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(s.type)) return true
  if (s.dataSource?.mode === 'search') return true
  const action = (s as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

function componentNeedsIslands(s: Component): boolean {
  if (selfNeedsIslands(s)) return true
  const { children } = s as { readonly children?: ReadonlyArray<Component | string> }
  if (!children || children.length === 0) return false
  return children.some((child) => {
    if (typeof child === 'string') return false
    if ('component' in child || '$ref' in child) return false
    return componentNeedsIslands(child as Component)
  })
}

function pageNeedsIslands(components: Page['components']): boolean {
  if (!components) return false
  return components.some((s) => {
    if ('component' in s || '$ref' in s) return false
    return componentNeedsIslands(s as Component)
  })
}

async function resolveIslandEntryFile(
  page: Page,
  islandBuilder?: IslandBuilder
): Promise<string | undefined> {
  const needs = pageNeedsIslands(page.components)
  if (!needs || !islandBuilder) return undefined

  try {
    const result = await islandBuilder.buildIslands()
    return result.entryFile
  } catch (error) {
    console.error('[RENDER] Failed to build island bundle', error)
    return undefined
  }
}

function toAccessDeniedResult(decision: AccessDecision): PageRenderResult | false {
  if (decision.allowed) return false
  if (decision.action === 'redirect') return { redirect: decision.url }
  if (decision.action === 'error') return { error: decision.message }
  return undefined
}

function findPageForPath(
  app: App,
  path: string
): { readonly page: Page; readonly params: Readonly<Record<string, string>> } | undefined {
  if (!app.pages || app.pages.length === 0) return undefined
  const pagePatterns = app.pages.map((p) => p.path)
  const match = findMatchingRoute(pagePatterns, path)
  if (!match) return undefined
  const page = app.pages[match.index]
  return page ? { page, params: match.params } : undefined
}

async function resolveLandingRedirect(
  app: App,
  path: string,
  session: SessionInfo | undefined,
  db: DataSourceDb | undefined
): Promise<PageRenderResult | undefined> {
  if (
    session === undefined ||
    app.auth?.landingPath === undefined ||
    app.auth.landingPath !== path
  ) {
    return undefined
  }
  const fetchAssignments =
    (db ?? noopDb).fetchUserAssignments ?? (async () => [] as readonly string[])
  const target = await resolveLandingPath(app, session, fetchAssignments)
  return target === path ? undefined : { redirect: target }
}

interface RenderPageHtmlInput {
  readonly app: App
  readonly page: Page
  readonly routeParams: Readonly<Record<string, string>>
  readonly detectedLanguage: string | undefined
  readonly islandEntryFile: string | undefined
  readonly resolvedSidebar: readonly ResolvedSidebarSection[] | undefined
  readonly markdownPayload: ResolvedMarkdownPage | undefined
}

function renderPageHtml(input: RenderPageHtmlInput): string {
  const {
    app,
    page,
    routeParams,
    detectedLanguage,
    islandEntryFile,
    resolvedSidebar,
    markdownPayload,
  } = input
  const injectAnalytics = shouldInjectAnalytics(app.analytics, page.path)
  const sessionTimeout = extractSessionTimeout(app.analytics)
  const html = renderToString(
    <DynamicPage
      page={page}
      components={app.components}
      theme={app.theme}
      languages={app.languages}
      tables={app.tables}
      buckets={app.buckets}
      detectedLanguage={detectedLanguage}
      routeParams={routeParams}
      builtInAnalyticsEnabled={injectAnalytics}
      builtInAnalyticsSessionTimeout={sessionTimeout}
      islandEntryFile={islandEntryFile}
      resolvedSidebar={resolvedSidebar}
      markdownPayload={markdownPayload}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}

async function resolveCollectionAndFilter(input: {
  readonly matchedPage: Page
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly db: DataSourceDb
  readonly previewMode: boolean
}): Promise<Page | { readonly unauthorized: true } | undefined> {
  const { matchedPage, app, routeParams, session, cookies, db, previewMode } = input
  const collectionResolution = await resolveCollectionPage(matchedPage, routeParams, db, {
    bypassFilter: previewMode,
  })
  if (collectionResolution.kind === 'not-found') return undefined
  const rawPage = collectionResolution.kind === 'match' ? collectionResolution.page : matchedPage
  return resolveAndFilterPage({ rawPage, app, routeParams, session, cookies, db })
}

async function resolveAndFilterPage(input: {
  readonly rawPage: Page
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly db: DataSourceDb
}): Promise<Page | { readonly unauthorized: true } | undefined> {
  const { rawPage, app, routeParams, session, cookies, db } = input

  const parentResolution = await resolvePageParentRecord(rawPage, routeParams, db)
  if (parentResolution.kind === 'not-found') return undefined

  const filteredPage = applyPageComponentFilters(
    rawPage,
    app,
    session,
    parentResolution.kind === 'record' ? parentResolution.record : undefined
  )

  const resolved = await resolvePageDataSources(filteredPage, app, routeParams, {
    session,
    cookies,
    db,
  })
  if (resolved === undefined) return undefined
  if ('unauthorized' in resolved) return { unauthorized: true }
  return resolveCustomHtmlSources(resolved)
}

export async function renderPageByPath(
  app: App,
  path: string,
  options?: {
    readonly detectedLanguage?: string
    readonly session?: SessionInfo
    readonly cookies?: Readonly<Record<string, string>>
    readonly db?: DataSourceDb
    readonly islandBuilder?: IslandBuilder
    readonly previewMode?: boolean
  }
): Promise<PageRenderResult> {
  const { detectedLanguage, session, cookies, db, islandBuilder, previewMode } = options ?? {}
  const found = findPageForPath(app, path)
  if (!found) return undefined
  const { page: matchedPage, params: routeParams } = found

  const denied = toAccessDeniedResult(checkPageAccess(matchedPage.access, app, session, path))
  if (denied !== false) return denied

  const landingRedirect = await resolveLandingRedirect(app, path, session, db)
  if (landingRedirect !== undefined) return landingRedirect

  const resolvedPage = await resolveCollectionAndFilter({
    matchedPage,
    app,
    routeParams,
    session,
    cookies,
    db: db ?? noopDb,
    previewMode: previewMode === true,
  })
  if (resolvedPage === undefined) return undefined
  if ('unauthorized' in resolvedPage) return { unauthorized: true }
  const page: Page = resolvedPage

  const [resolvedSidebar, islandEntryFile, markdownPayload] = await Promise.all([
    resolvePageSidebar(page.layout?.sidebar, app, { session, cookies, db: db ?? noopDb }),
    resolveIslandEntryFile(page, islandBuilder),
    resolveMarkdownPage(page, routeParams),
  ])
  return renderPageHtml({
    app,
    page,
    routeParams,
    detectedLanguage,
    islandEntryFile,
    resolvedSidebar,
    markdownPayload,
  })
}

export async function renderPage(
  app: App,
  path: string,
  options?: {
    readonly detectedLanguage?: string
    readonly session?: SessionInfo
    readonly cookies?: Readonly<Record<string, string>>
    readonly db?: DataSourceDb
    readonly islandBuilder?: IslandBuilder
    readonly previewMode?: boolean
  }
): Promise<PageRenderResult> {
  const result = await renderPageByPath(app, path, options)
  if (result) return result

  if (path === '/') {
    const injectAnalytics = shouldInjectAnalytics(app.analytics, '/')
    const defaultSessionTimeout = extractSessionTimeout(app.analytics)
    const html = renderToString(
      <DefaultHomePage
        app={app}
        builtInAnalyticsEnabled={injectAnalytics}
        builtInAnalyticsSessionTimeout={defaultSessionTimeout}
      />
    )
    return `<!DOCTYPE html>\n${html}`
  }

  return undefined
}
