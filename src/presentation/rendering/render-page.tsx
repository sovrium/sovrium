/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { renderToString } from 'react-dom/server'
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { resolveLandingPath } from '@/domain/services/pages/landing-resolver'
import { checkPageAccess, type AccessDecision } from '@/domain/services/pages/page-access-check'
import { matchContentDirIndexBasePath } from '@/domain/utils/content-dir/content-dir-index-match'
import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  type CurrentUserContext,
} from '@/domain/validators/row-level-evaluator'
import {
  extractSessionTimeout,
  shouldInjectAnalytics,
} from '@/presentation/rendering/analytics-helpers'
import { resolveCustomHtmlSources } from '@/presentation/rendering/custom-html-resolver'
import { resolvePageDataSources } from '@/presentation/rendering/data-source-resolver'
import { resolveEditorContext } from '@/presentation/rendering/editors/editor-context-resolver'
import { evaluateEmbeddedFormRefsAccess } from '@/presentation/rendering/forms/form-ref-access-check'
import { expandFormRefs } from '@/presentation/rendering/forms/form-ref-resolver'
import {
  isContentDirSlugNotFound,
  resolveMarkdownPage,
} from '@/presentation/rendering/markdown-page-resolver'
import { resolveOpenDrawerDispatches } from '@/presentation/rendering/open-drawer-dispatch-resolver'
import { resolveCollectionPage } from '@/presentation/rendering/page-collection-resolver'
import { resolvePageParentRecord } from '@/presentation/rendering/page-parent-resolver'
import { applyPageLevelRecordBinding } from '@/presentation/rendering/page-system-record-binding'
import { resolvePageSidebar } from '@/presentation/rendering/sidebar-resolver'
import { resolvePageToc } from '@/presentation/rendering/toc-resolver'
import { applyVisibilityToComponents } from '@/presentation/rendering/visibility-filter'
import { DefaultHomePage } from '@/presentation/ui/pages/DefaultHomePage'
import { DynamicPage } from '@/presentation/ui/pages/DynamicPage'
import { resolvePageLanguage } from '@/presentation/ui/pages/PageLangResolver'
import { someComponentInTree } from '@/presentation/utils/component-template-walker'
import { ISLAND_COMPONENT_TYPES } from '@/presentation/utils/island-component-types'
import { isListIslandMode } from '@/presentation/utils/list-island-mode'
import { isRecordFieldSystemMode } from '@/presentation/utils/system-detail-mode'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { RowLevelWhen } from '@/domain/models/app/tables/permissions'
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

function renderPermissionBlockedPage(_app: App, _detectedLanguage: string | undefined): string {
  return (
    '<!DOCTYPE html>\n' +
    '<html lang="en"><head><meta charset="utf-8">' +
    '<title>Access denied</title></head><body>' +
    '<main><h1>Access denied</h1>' +
    '<p>You do not have permission to view this record.</p>' +
    '</main></body></html>'
  )
}

async function overlayUserAccessRoles(
  session: SessionInfo,
  db: DataSourceDb
): Promise<SessionInfo> {
  if (!db.fetchUserAccessRoles) return session
  const extras = await db.fetchUserAccessRoles(session.userId).catch(() => [] as readonly string[])
  if (extras.length === 0) return session
  const merged = [...new Set<string>([session.role, ...extras])]
  return { ...session, effectiveRoles: merged }
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
    { readonly type: 'oauth'; readonly providers: readonly string[] } | undefined
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

function markComponentReadOnly(component: Component): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _readOnly: true,
    },
  }
}

function getSynthesizedUpdateTable(component: Component): string | undefined {
  if (component.type !== 'form' && component.type !== 'data-form') return undefined
  const action = component.action as { readonly type?: string } | undefined
  if (action?.type !== undefined) return undefined
  const dataSource = component.dataSource as
    { readonly table?: string; readonly mode?: string } | undefined
  if (!dataSource || dataSource.mode !== 'single' || typeof dataSource.table !== 'string') {
    return undefined
  }
  return dataSource.table
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

    if (action?.type === 'crud' && action?.operation === 'update') {
      if (isCrudUpdateAllowed(action.table, tables, session)) return component
      return hideComponent(component)
    }

    const synthesizedTable = getSynthesizedUpdateTable(component)
    if (synthesizedTable !== undefined && !isCrudUpdateAllowed(synthesizedTable, tables, session)) {
      return markComponentReadOnly(component)
    }

    return component
  })
}

const buildCommandPaletteComponent = (app: App): Component => {
  const navigablePages = (app.pages ?? [])
    .filter((page) => typeof page.path === 'string' && !page.path.includes(':'))
    .map((page) => ({
      name: page.name,
      path: page.path,
      title: resolveTranslationPattern(
        page.meta?.title && page.meta.title.length > 0 ? page.meta.title : page.name,
        app.languages?.default ?? 'en',
        app.languages
      ),
    }))
  return { type: 'command-palette', props: { pages: navigablePages } } as unknown as Component
}

function applyPageComponentFilters(
  rawPage: Page,
  app: App,
  session: SessionInfo | undefined,
  parentRecord: Readonly<Record<string, unknown>> | undefined,
  detectedLanguage?: string
): Page {
  const authStripped = stripAuthActionsIfUnconfigured(rawPage.components, !!app.auth)
  const oauthFiltered = stripUnconfiguredOAuthForms(authStripped, app)
  const visibilityFiltered = applyVisibilityToComponents(oauthFiltered, session)
  const createPermFiltered = applyCrudCreatePermissions(visibilityFiltered, app.tables, session)
  const updatePermFiltered = applyCrudUpdatePermissions(createPermFiltered, app.tables, session)
  const activeLang = resolvePageLanguage(rawPage, app.languages, detectedLanguage).lang
  const expanded = expandFormRefs(updatePermFiltered, app, {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
    session,
    activeLang,
  })
  const editorResolved = resolveEditorContext(expanded, {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
  })
  const withToc = resolvePageToc(editorResolved)
  const withDrawerDispatches = resolveOpenDrawerDispatches(withToc ?? [])
  if (app.palette?.enabled === false) {
    return { ...rawPage, components: withDrawerDispatches }
  }
  return {
    ...rawPage,
    components: [...withDrawerDispatches, buildCommandPaletteComponent(app)],
  }
}

const ISLAND_ACTION_TYPES = new Set(['auth', 'crud', 'automation'])

function isSingleRecordBoundForm(s: Component): boolean {
  return (
    (s.type === 'form' || s.type === 'data-form') &&
    s.dataSource?.mode === 'single' &&
    typeof s.dataSource.table === 'string'
  )
}

function hasDataIslandProp(s: Component): boolean {
  const props = (s as Record<string, unknown>).props as Record<string, unknown> | undefined
  return typeof props?.['data-island'] === 'string'
}

function selfNeedsIslands(s: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(s.type)) return true
  if (hasDataIslandProp(s)) return true
  if (s.dataSource?.mode === 'search') return true
  if (isListIslandMode(s)) return true
  if (isRecordFieldSystemMode(s)) return true
  if (isSingleRecordBoundForm(s)) return true
  const action = (s as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

function pageNeedsIslands(page: Page, components: App['components']): boolean {
  if (page.presence === true) return true
  return someComponentInTree(page.components, components, (s) => selfNeedsIslands(s as Component))
}

async function resolveIslandEntryFile(
  page: Page,
  components: App['components'],
  islandBuilder?: IslandBuilder
): Promise<string | undefined> {
  const needs = pageNeedsIslands(page, components)
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
):
  | {
      readonly page: Page
      readonly params: Readonly<Record<string, string>>
      readonly indexBasePathPattern?: string
    }
  | undefined {
  if (!app.pages || app.pages.length === 0) return undefined
  const pagePatterns = app.pages.map((p) => p.path)
  const match = findMatchingRoute(pagePatterns, path)
  if (match) {
    const page = app.pages[match.index]
    return page ? { page, params: match.params } : undefined
  }
  const indexMatch = matchContentDirIndexBasePath(app.pages, path)
  return indexMatch
    ? {
        page: indexMatch.page,
        params: indexMatch.routeParams,
        indexBasePathPattern: indexMatch.basePathPattern,
      }
    : undefined
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
  readonly session: SessionInfo | undefined
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
    session,
  } = input
  const injectAnalytics = shouldInjectAnalytics(app.analytics, page.path)
  const sessionTimeout = extractSessionTimeout(app.analytics)
  const html = renderToString(
    <DynamicPage
      page={page}
      badgeEnabled={isBadgeEnabled(app.badge)}
      components={app.components}
      theme={app.theme}
      languages={app.languages}
      tables={app.tables}
      buckets={app.buckets}
      landingPath={app.auth?.landingPath}
      detectedLanguage={detectedLanguage}
      routeParams={routeParams}
      builtInAnalyticsEnabled={injectAnalytics}
      builtInAnalyticsSessionTimeout={sessionTimeout}
      islandEntryFile={islandEntryFile}
      resolvedSidebar={resolvedSidebar}
      markdownPayload={markdownPayload}
      session={session}
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
  readonly detectedLanguage?: string
}): Promise<
  Page | { readonly unauthorized: true } | { readonly permissionBlocked: true } | undefined
> {
  const { matchedPage, app, routeParams, session, cookies, db, previewMode, detectedLanguage } =
    input
  const rowLevelReadCheck =
    session !== undefined
      ? buildCollectionRowLevelReadCheck(matchedPage, app, session, db)
      : undefined
  const collectionResolution = await resolveCollectionPage(matchedPage, routeParams, db, {
    bypassFilter: previewMode,
    ...(rowLevelReadCheck !== undefined ? { rowLevelReadCheck } : {}),
  })
  if (collectionResolution.kind === 'not-found') return undefined
  if (collectionResolution.kind === 'permission-blocked') return { permissionBlocked: true }
  const rawPage = collectionResolution.kind === 'match' ? collectionResolution.page : matchedPage
  const collectionRecord =
    collectionResolution.kind === 'match' ? collectionResolution.record : undefined
  return resolveAndFilterPage({
    rawPage,
    app,
    routeParams,
    session,
    cookies,
    db,
    ...(collectionRecord !== undefined ? { collectionRecord } : {}),
    ...(detectedLanguage !== undefined ? { detectedLanguage } : {}),
  })
}

function buildCollectionRowLevelReadCheck(
  page: Page,
  app: App,
  session: SessionInfo,
  db: DataSourceDb
): ((record: Readonly<Record<string, unknown>>) => Promise<boolean>) | undefined {
  if (page.collection === undefined) return undefined
  const tableName = page.collection.table
  const table = app.tables?.find((t) => t.name === tableName)
  const predicate = table?.rowLevelPermissions?.read?.when
  if (!predicate) return undefined
  const isAdmin = session.isUnrestricted === true || session.role === 'admin'
  if (isAdmin) return undefined
  return async (record) => {
    const scopeTables = collectScopeTablesFromPredicate(predicate)
    const assignments = await loadAssignmentsForScopes(session.userId, scopeTables, db)
    const ctx: CurrentUserContext = {
      userId: session.userId,
      email: session.email,
      role: session.role,
      isUnrestricted: session.isUnrestricted === true,
      assignments,
    }
    return evaluateRecordAgainstPredicate(record, predicate, ctx)
  }
}

function scopeFromTypedPredicateValue(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const obj = value as {
    readonly kind?: string
    readonly path?: { readonly kind?: string; readonly tableSlug?: string }
  }
  if (obj.kind !== 'currentUser') return undefined
  if (obj.path?.kind !== 'assignment') return undefined
  return typeof obj.path.tableSlug === 'string' ? obj.path.tableSlug : undefined
}

function scopeFromTemplatePredicateValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const prefix = '$currentUser.assignments.'
  if (!value.startsWith(prefix)) return undefined
  const slug = value.slice(prefix.length)
  return slug.length > 0 ? slug : undefined
}

function collectScopeTablesFromPredicate(predicate: RowLevelWhen): readonly string[] {
  if (isPredicateGroup(predicate)) {
    return predicate.conditions.flatMap(collectScopeTablesFromPredicate)
  }
  const fromTemplate = scopeFromTemplatePredicateValue(predicate.value)
  if (fromTemplate !== undefined) return [fromTemplate]
  const fromTyped = scopeFromTypedPredicateValue(predicate.value)
  if (fromTyped !== undefined) return [fromTyped]
  return []
}

async function loadAssignmentsForScopes(
  userId: string,
  scopeTables: readonly string[],
  db: DataSourceDb
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (scopeTables.length === 0 || !db.fetchUserAssignments) {
    return new Map<string, readonly string[]>()
  }
  const fetchAssignments = db.fetchUserAssignments
  const entries = await Promise.all(
    scopeTables.map(async (slug): Promise<readonly [string, readonly string[]]> => [
      slug,
      await fetchAssignments(userId, slug).catch(() => [] as readonly string[]),
    ])
  )
  return new Map(entries)
}

async function resolveAndFilterPage(input: {
  readonly rawPage: Page
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  readonly session: SessionInfo | undefined
  readonly cookies: Readonly<Record<string, string>> | undefined
  readonly db: DataSourceDb
  readonly collectionRecord?: Readonly<Record<string, unknown>>
  readonly detectedLanguage?: string
}): Promise<Page | { readonly unauthorized: true } | undefined> {
  const { rawPage, app, routeParams, session, cookies, db, collectionRecord, detectedLanguage } =
    input

  const parentResolution = await resolvePageParentRecord(rawPage, routeParams, db)
  if (parentResolution.kind === 'not-found') return undefined

  const hostRecord = parentResolution.kind === 'record' ? parentResolution.record : collectionRecord

  const boundPage = applyPageLevelRecordBinding(rawPage, routeParams, hostRecord)

  const filteredPage = applyPageComponentFilters(
    boundPage,
    app,
    session,
    hostRecord,
    detectedLanguage
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

async function resolveOverlayedSession(
  rawSession: SessionInfo | undefined,
  db: DataSourceDb | undefined
): Promise<SessionInfo | undefined> {
  if (!rawSession) return undefined
  return overlayUserAccessRoles(rawSession, db ?? noopDb)
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
  const {
    detectedLanguage,
    session: rawSession,
    cookies,
    db,
    islandBuilder,
    previewMode,
  } = options ?? {}
  const found = findPageForPath(app, path)
  if (!found) return undefined
  const { page: matchedPage, params: routeParams, indexBasePathPattern } = found

  const session = await resolveOverlayedSession(rawSession, db)

  const denied = toAccessDeniedResult(checkPageAccess(matchedPage.access, app, session, path))
  if (denied !== false) return denied
  if (evaluateEmbeddedFormRefsAccess(app, matchedPage, session) === 'denied') return undefined

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
    ...(detectedLanguage !== undefined ? { detectedLanguage } : {}),
  })
  if (resolvedPage === undefined) return undefined
  if ('unauthorized' in resolvedPage) return { unauthorized: true }
  if ('permissionBlocked' in resolvedPage) {
    return renderPermissionBlockedPage(app, detectedLanguage)
  }
  const page: Page = resolvedPage

  if (await isContentDirSlugNotFound(page, routeParams)) return undefined

  const [resolvedSidebar, islandEntryFile, markdownPayload] = await Promise.all([
    resolvePageSidebar(page.layout?.sidebar, app, { session, cookies, db: db ?? noopDb }),
    resolveIslandEntryFile(page, app.components, islandBuilder),
    resolveMarkdownPage(page, routeParams, app, detectedLanguage, indexBasePathPattern),
  ])
  return renderPageHtml({
    app,
    page,
    routeParams,
    detectedLanguage,
    islandEntryFile,
    resolvedSidebar,
    markdownPayload,
    session,
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
