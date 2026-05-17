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

/**
 * Island builder interface — injected by the infrastructure layer
 * to keep presentation free of infrastructure imports.
 */
export interface IslandBuilder {
  readonly buildIslands: () => Promise<{ readonly entryFile: string }>
}

/**
 * No-op database adapter used when no db dependency is provided.
 * Returns empty results — pages without dataSource bindings are unaffected.
 */
const noopDb: DataSourceDb = {
  fetchRecords: async () => [],
  countRecords: async () => 0,
  fetchSingleRecord: async () => undefined,
}

// ─── Auth action stripping ──────────────────────────────────────────────────

/**
 * Strips auth actions from form components when auth is not configured.
 * This ensures auth forms render as empty (hidden) when the app has no auth strategies.
 */
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

/**
 * OAuth action shape used for provider-checking
 */
interface OAuthActionShape {
  readonly type: string
  readonly strategy?: string
  readonly provider?: string
}

/**
 * Strips OAuth form components when the requested OAuth provider is not configured
 * in auth strategies. This prevents OAuth forms from rendering when the provider
 * is not available.
 */
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

    // If provider is not in configured providers, hide the component
    if (!action.provider || !configuredProviders.includes(action.provider)) {
      return hideComponent(component)
    }

    return component
  })
}

/**
 * Checks if a session role is allowed to create records in a table.
 * Returns true if the table has no create restrictions or the role is permitted.
 */
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

/**
 * Hides a component section by injecting `display: none` into its style prop.
 */
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

/**
 * Checks if a session role is allowed to update records in a table.
 * Returns true if the table has no update restrictions or the role is permitted.
 */
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

/**
 * Applies CRUD create permission filtering to page components.
 *
 * For each component that has a `crud` create action, checks if the table has
 * restricted create permissions (`permissions.create`). If the current session
 * role is not in the allowed roles (or the user is unauthenticated), the component
 * is hidden via `display: none` style injection — matching the `applyVisibilityToSection`
 * pattern — so it is present in the DOM but not visible.
 */
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

/**
 * Applies CRUD update permission filtering to page components.
 *
 * For each component that has a `crud` update action, checks if the table has
 * restricted update permissions (`permissions.update`). If the current session
 * role is not in the allowed roles (or the user is unauthenticated), the component
 * is hidden via `display: none` style injection — matching the `applyVisibilityToSection`
 * pattern — so it is present in the DOM but not visible.
 */
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

/**
 * Applies all component filters to a page: auth stripping, OAuth filtering,
 * visibility rules, CRUD create/update permission checks, and `formRef`
 * expansion (turning page-form components into pre-rendered embedded forms
 * via `expandFormRefs` from `forms/form-ref-resolver.ts`).
 *
 * `parentRecord` (Y-5) is forwarded to `expandFormRefs` so embedded forms
 * can resolve `inlinePrefill` tokens like `$parent.id` against the host
 * page's `dataSource: { mode: 'single' }` record.
 */
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
  return {
    ...rawPage,
    components: expandFormRefs(updatePermFiltered, app, {
      ...(parentRecord !== undefined ? { parentRecord } : {}),
    }),
  }
}

/**
 * Checks whether a single component (or any of its descendants) needs the
 * island runtime. Matches explicit island component types (see
 * `ISLAND_COMPONENT_TYPES`), search-mode sections, and form sections with
 * auth/crud actions. Recursively descends into `children` so nested
 * data-tables (e.g. inside a container's children array) are detected.
 */
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

/**
 * Checks whether a resolved page needs the island runtime by walking each
 * top-level component (and its descendants) via `componentNeedsIslands`.
 */
function pageNeedsIslands(components: Page['components']): boolean {
  if (!components) return false
  return components.some((s) => {
    if ('component' in s || '$ref' in s) return false
    return componentNeedsIslands(s as Component)
  })
}

/**
 * Builds the island bundle and returns the entry filename if the page has island sections
 */
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

/**
 * Converts an AccessDecision into a denial result (redirect, error, or undefined for 404).
 * Returns false if the page is allowed (access granted).
 */
function toAccessDeniedResult(decision: AccessDecision): PageRenderResult | false {
  if (decision.allowed) return false
  if (decision.action === 'redirect') return { redirect: decision.url }
  if (decision.action === 'error') return { error: decision.message }
  return undefined // 'not-found' → 404
}

/**
 * Locates the page declaration matching `path` and returns it together
 * with the route parameters extracted from dynamic segments. Returns
 * `undefined` when no page matches — the caller then 404s.
 */
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

/**
 * Resolves the post-login landing redirect for an authenticated session
 * navigating to `auth.landingPath`. Returns a `redirect` result when the
 * resolver picks a different URL, or `undefined` to fall through to normal
 * page rendering (the access guard already bounced anonymous visitors).
 */
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

/**
 * Builds the React-rendered HTML output for a fully-resolved page.
 * Extracted so `renderPageByPath` stays under its statement/complexity
 * limits — the post-login landing resolver added enough state to push
 * it over otherwise.
 */
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

/**
 * Renders a page by path to HTML string for server-side rendering
 *
 * Supports both static routes (exact match) and dynamic routes (with :param segments).
 * Enforces page access control before rendering.
 *
 * @param deps - Optional infrastructure dependencies (injected by PageRendererLive)
 */
/**
 * Resolve the host record (via Y-5 page-level dataSource) and apply all
 * component filters in one pass.
 *
 * Returns `undefined` when the requested host record is missing (the
 * caller 404s the page); returns `{ unauthorized: true }` when a
 * descendant component's `$currentUser` filter trips the auth guard;
 * returns the fully-resolved `Page` otherwise.
 *
 * Extracted from `renderPageByPath` so the entry function stays under the
 * cyclomatic-complexity cap. The two steps are intentionally fused
 * because the filter pipeline (`expandFormRefs` in particular) needs the
 * resolved parent record to expand `inlinePrefill` tokens before the
 * downstream `resolvePageDataSources` walk runs.
 */
/**
 * Apply the collection-page resolver to the matched page (if any) and
 * then run the standard component-filter pipeline.
 *
 * Returns the fully-resolved `Page`, or `undefined` when the
 * collection slug failed to resolve / failed a filter (404), or
 * `{ unauthorized: true }` when a descendant data source trips the
 * auth guard. Extracted from `renderPageByPath` so its cyclomatic
 * complexity stays under the project cap after the collection step
 * was added.
 */
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
  // APP-PAGES-PUBLISHING-003: editorial-role preview bypasses
  // collection.filter so admins/editors can preview drafts at the
  // canonical public URL. The route layer guarantees `previewMode` is
  // only `true` for editorial sessions, so the resolver does not need
  // to recheck the role here.
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

  // Y-5: Resolve the page-level `dataSource: { mode: 'single' }` (if any)
  // before component filters run so `expandFormRefs` can resolve
  // `inlinePrefill` tokens like `$parent.id` against the host record. The
  // resolution is independent of `resolvePageDataSources` because that
  // function operates on per-component bindings, while inline-create
  // needs the host page's record visible to all descendant form-refs.
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

  // Check page access control — deny returns early with redirect, error, or 404
  const denied = toAccessDeniedResult(checkPageAccess(matchedPage.access, app, session, path))
  if (denied !== false) return denied

  // Post-login landing resolver — runs only for the configured `auth.landingPath`
  // and only after the access guard has already bounced anonymous visitors.
  const landingRedirect = await resolveLandingRedirect(app, path, session, db)
  if (landingRedirect !== undefined) return landingRedirect

  // Collection-page resolution (US-PAGES-COLLECTION-PAGES-001) is fused
  // with the standard component-filter pipeline so this entry function
  // stays under the project cyclomatic-complexity cap.
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

/**
 * Renders any page by path to HTML string for server-side rendering
 *
 * For the homepage ('/'), falls back to a default homepage when no custom page is configured.
 * For all other paths, returns undefined if no matching page is found.
 *
 * @param app - Validated application data from AppSchema
 * @param path - Page path to render (e.g., '/', '/about')
 * @param detectedLanguage - Optional detected language from Accept-Language header
 * @returns Complete HTML document as string with DOCTYPE, or undefined if page not found
 */
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

  // Fallback: render default homepage when path is '/' and no custom page exists
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
