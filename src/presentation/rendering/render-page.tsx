/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- page renderer composes many cross-cutting concerns
   (access control, formRef gating, collection resolution, sidebar, islands,
   markdown, landing redirects, language detection). Already at the 400-line
   cap before [internal ref] added formRef access composition. */

import { renderToString } from 'react-dom/server'
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { resolveLandingPath } from '@/domain/services/pages/landing-resolver'
import { checkPageAccess, type AccessDecision } from '@/domain/services/pages/page-access-check'
import { isOperatorConsoleApp } from '@/domain/utils/admin-data-nav'
import { matchContentDirIndexBasePath } from '@/domain/utils/content-dir/content-dir-index-match'
import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import { resolveTranslationPattern } from '@/domain/utils/translation-resolver'
import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  type CurrentUserContext,
} from '@/domain/validators/row-level-evaluator'
import { logError } from '@/infrastructure/logging/logger'
import {
  extractSessionTimeout,
  shouldInjectAnalytics,
} from '@/presentation/rendering/analytics-helpers'
import {
  resolveComponentsCodeHighlights,
  resolvePageCodeHighlights,
} from '@/presentation/rendering/code-highlight-resolver'
import { highlightComponentCodeBlocks } from '@/presentation/rendering/component-code-highlighter'
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
import { resolveSelectOptionSources } from '@/presentation/rendering/select-option-source-resolver'
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
  // Fails closed: no `user_access` reader means no assignments, so an
  // assignment filter matches nothing rather than trusting a cookie.
  fetchUserAssignments: async () => [],
}

/**
 * Bug 2 / [internal ref]: render a minimal access-denied page
 * for a `permission-blocked` collection-page outcome. Returns 200-shaped
 * HTML carrying the "Access denied" marker the spec's regex looks for
 * (`/(access|permission|autorisation|forbidden)/i`). Kept simple and
 * dependency-free so it works for every language / theme combination
 * without needing a per-app configurable template — a richer UX (custom
 * page slot, i18n, theme integration) is a follow-up tier.
 */
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

/**
 * Bug 2 / [internal ref]: overlay user_access roles onto the
 * session. Mirrors `mergeRoles` in `row-level-guard.ts`. Always returns a
 * fresh SessionInfo with `effectiveRoles` populated (deduped union of the
 * Better Auth role + all user_access roles); the original `role` field is
 * preserved so downstream code that keys on it (analytics, etc.) is
 * unaffected. Errors from the db adapter (missing table, etc.) are absorbed
 * — the overlay degrades to "just the Better Auth role" silently.
 */
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
    { readonly type: 'oauth'; readonly providers: readonly string[] } | undefined
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
 * Marks a component as read-only by injecting `_readOnly: true` into its
 * `props`. Used for PG-04 synthesized CRUD update forms (form/data-form with
 * `dataSource: { mode: 'single' }`) when the current session role is not
 * permitted to update the bound table. `renderCrudUpdateForm` reads the flag
 * and propagates `disabled: true` to every field skeleton + omits the Save
 * button.
 *
 * Distinct from `hideComponent` (which uses `display: none`) because the spec
 * requires the form to remain visible with
 * disabled inputs — preventing edits while still showing the record values.
 */
function markComponentReadOnly(component: Component): Component {
  return {
    ...component,
    props: {
      ...(component.props ?? {}),
      _readOnly: true,
    },
  }
}

/**
 * Detects the PG-04 synthesized CRUD update case: a `form` / `data-form`
 * component with `dataSource: { mode: 'single', table: <string> }` and no
 * explicit `action`. The runtime synthesizes a `{ type: 'crud',
 * operation: 'update' }` action at `renderForm` time (see
 * `maybeSynthesizeCrudUpdateAction` in interactive-renderers.tsx), so the
 * page-level permission filter needs to reach into the dataSource to know
 * which table to check.
 */
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

/**
 * Applies CRUD update permission filtering to page components.
 *
 * For each component that has a `crud` update action, checks if the table has
 * restricted update permissions (`permissions.update`). If the current session
 * role is not in the allowed roles (or the user is unauthenticated), the component
 * is hidden via `display: none` style injection — matching the `applyVisibilityToSection`
 * pattern — so it is present in the DOM but not visible.
 *
 * PG-04: also handles the `data-form` / `form`
 * + `dataSource: { mode: 'single' }` case where the CRUD update action is
 * synthesized at render time. For those components, denial does NOT hide the
 * component — the form remains visible with `_readOnly: true` so all fields
 * render as disabled and the Save button is suppressed.
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

/**
 * Applies all component filters to a page: auth stripping, OAuth filtering,
 * visibility rules, CRUD create/update permission checks, and `formRef`
 * expansion (turning page-form components into pre-rendered embedded forms
 * via `expandFormRefs` from `forms/form-ref-resolver.ts`).
 *
 * `parentRecord` (Y-5) is forwarded to `expandFormRefs` so embedded forms
 * can resolve `inlinePrefill` tokens like `$parent.id` against the host
 * page's `dataSource: { mode: 'single' }` record.
 *
 * A render-time-only `command-palette` component is appended to every page so
 * the global `Cmd+K` palette is available app-wide without schema authoring.
 *
 * The synthesized component carries the app's navigable pages (static pages
 * only — record-detail templates with a `:param` segment are excluded) in its
 * `props.pages` so the palette runtime can offer "Go to <page>" quick actions
 * without an extra API call. Tables reach the renderer separately via the
 * component-dispatch `tables` config.
 */
const buildCommandPaletteComponent = (app: App): Component => {
  // Resolve `$t:` tokens in page titles.
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

/**
 * Inputs to {@link applyPageComponentFilters}. An options object rather than a
 * positional list: the pipeline has accumulated a per-request locale (P9), a
 * request query (GAP-3) and a URL-prefix locale ([internal ref]..039), and a
 * seventh positional argument is a call site nobody can read.
 */
interface PageComponentFilterInput {
  readonly rawPage: Page
  readonly app: App
  readonly session: SessionInfo | undefined
  readonly parentRecord: Readonly<Record<string, unknown>> | undefined
  readonly detectedLanguage?: string
  readonly requestQuery?: Readonly<Record<string, string>>
  readonly urlLanguage?: string
}

function applyPageComponentFilters(input: PageComponentFilterInput): Page {
  const { rawPage, app, session, parentRecord, detectedLanguage, requestQuery, urlLanguage } = input
  const authStripped = stripAuthActionsIfUnconfigured(rawPage.components, !!app.auth)
  const oauthFiltered = stripUnconfiguredOAuthForms(authStripped, app)
  const visibilityFiltered = applyVisibilityToComponents(oauthFiltered, session)
  const createPermFiltered = applyCrudCreatePermissions(visibilityFiltered, app.tables, session)
  const updatePermFiltered = applyCrudUpdatePermissions(createPermFiltered, app.tables, session)
  // P9: resolve the host page's active language the SAME way the page's own
  // `$t:` components resolve (URL prefix > page.meta.lang > detectedLanguage >
  // default) so an embedded `formRef` localizes its `$t:` title/label/onSuccess
  // to match the rest of the page rather than always the default locale.
  const activeLang = resolvePageLanguage(rawPage, app.languages, detectedLanguage, urlLanguage).lang
  const expanded = expandFormRefs(updatePermFiltered, app, {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
    session,
    activeLang,
    // GAP-3 / [internal ref]: host request query for embedded `$query` prefill.
    ...(requestQuery !== undefined ? { query: requestQuery } : {}),
  })
  // GAP-I2: resolve config-editor `inlinePrefill` `$record.*` tokens against
  // the host page record into a literal `_submitContext` the editor island
  // merges into its submit body (carries the page record FK).
  const editorResolved = resolveEditorContext(expanded, {
    ...(parentRecord !== undefined ? { parentRecord } : {}),
  })
  // P-06: assign anchor ids to heading components and plumb them onto any
  // `type: 'toc'` components on the page. Runs AFTER expandFormRefs so
  // collection-resolved + formRef-expanded headings are visible, BEFORE the
  // synthesized `command-palette` is appended (the palette is a sibling
  // overlay and never contains author headings).
  const withToc = resolvePageToc(editorResolved)
  // PG-04: tag any drawer referenced by a sibling `onRowClick.action ===
  // 'openDrawer'` with `_openDrawerDispatchedById` so its island starts
  // closed (defaultOpen=false). The data-table row-click handler dispatches
  // a `sovrium:open-drawer` CustomEvent to open the matching drawer.
  const withDrawerDispatches = resolveOpenDrawerDispatches(withToc ?? [])
  // The platform Cmd+K command palette is appended to every page by default.
  // An app may opt out via `palette: { enabled: false }` — e.g. when it
  // ships its own search overlay also bound to Cmd+K, so both would otherwise
  // open on the same keystroke. When opted out, the synthesized component is
  // omitted entirely (and with it the palette's global keybinding).
  if (app.palette?.enabled === false) {
    return { ...rawPage, components: withDrawerDispatches }
  }
  return {
    ...rawPage,
    components: [...withDrawerDispatches, buildCommandPaletteComponent(app)],
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

/**
 * PG-04: a `form` / `data-form` bound to a single-record dataSource has a
 * synthesized CRUD update action injected by `renderForm` at render time
 * (see `maybeSynthesizeCrudUpdateAction`). The hydrated `crud-form` island
 * must still mount so the synthesized Save submission goes through the
 * Records API mutation pipeline instead of falling through as a static
 * SSR form post.
 */
function isSingleRecordBoundForm(s: Component): boolean {
  return (
    (s.type === 'form' || s.type === 'data-form') &&
    s.dataSource?.mode === 'single' &&
    typeof s.dataSource.table === 'string'
  )
}

/**
 * True when a component carries an explicit `data-island="<type>"` marker in its
 * `props` (the render-time island-injection pattern — e.g. the admin dashboard's
 * `admin-sidebar` mounted onto a generic `container`). The island bundle must be
 * BUILT when such a marker is present, or the injected hydration script 404s.
 * Mirrors `hasDataIslandProp` in `DynamicPage.tsx` (both sites must agree).
 */
function hasDataIslandProp(s: Component): boolean {
  const props = (s as Record<string, unknown>).props as Record<string, unknown> | undefined
  return typeof props?.['data-island'] === 'string'
}

function selfNeedsIslands(s: Component): boolean {
  if (ISLAND_COMPONENT_TYPES.has(s.type)) return true
  if (hasDataIslandProp(s)) return true
  if (s.dataSource?.mode === 'search') return true
  // CAP-1: a client-fetching data-bound list (listDisplay.itemTemplate + a
  // table/system binding) hydrates the `list` island — build its bundle.
  if (isListIslandMode(s)) return true
  // CAP-2: a record-field that self-binds to a system detail endpoint hydrates
  // the `record-field-system` island — build its bundle.
  if (isRecordFieldSystemMode(s)) return true
  if (isSingleRecordBoundForm(s)) return true
  const action = (s as Record<string, unknown>).action as { type?: string } | undefined
  return action?.type !== undefined && ISLAND_ACTION_TYPES.has(action.type)
}

/**
 * Checks whether a resolved page needs the island runtime by walking each
 * component (children AND referenced `app.components` templates, via
 * `someComponentInTree`) against `selfNeedsIslands`. A page with
 * `presence: true` (Wave-6) always needs the runtime so the page-level
 * `presence-indicator` island bundle is built.
 *
 * Mirrors `hasIslandComponents` in `DynamicPage.tsx` (both sites must agree:
 * bundle built but no script tag → gray skeleton; script tag but no bundle →
 * 404 on the script).
 */
function pageNeedsIslands(page: Page, components: App['components']): boolean {
  if (page.presence === true) return true
  return someComponentInTree(page.components, components, (s) => selfNeedsIslands(s as Component))
}

/**
 * Builds the island bundle and returns the entry filename if the page has island sections
 */
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
    logError('[RENDER] Failed to build island bundle', error)
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
 *
 * When no page pattern matches directly, the path is retried against the BASE
 * PATH of every index-bearing collection (`contentDir.index`, [internal ref]): a
 * request for `/docs` resolves to the `/docs/:slug` page with the index slug
 * pre-filled, and `indexBasePathPattern` is surfaced so the markdown resolver
 * synthesises the canonical / hreflang SEO at the base path (never the slugged
 * URL).
 */
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
  // Fallback: the base path of an index-bearing collection serves its index
  // article.
  const indexMatch = matchContentDirIndexBasePath(app.pages, path)
  return indexMatch
    ? {
        page: indexMatch.page,
        params: indexMatch.routeParams,
        indexBasePathPattern: indexMatch.basePathPattern,
      }
    : undefined
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
  const fetchAssignments = (db ?? noopDb).fetchUserAssignments
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
  /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
  readonly urlLanguage: string | undefined
  readonly islandEntryFile: string | undefined
  readonly resolvedSidebar: readonly ResolvedSidebarSection[] | undefined
  readonly markdownPayload: ResolvedMarkdownPage | undefined
  readonly session: SessionInfo | undefined
  /**
   * `app.components` after the async code-highlight pre-pass. `app.components`
   * is passed to `DynamicPage` BY VALUE, so a resolver that only rewrote
   * `page.components` would leave every `code` block reached through a
   * `{ component: 'name' }` reference unhighlighted — hence the explicit
   * override.
   */
  readonly appComponents: App['components']
}

function renderPageHtml(input: RenderPageHtmlInput): string {
  const {
    app,
    page,
    routeParams,
    detectedLanguage,
    urlLanguage,
    islandEntryFile,
    resolvedSidebar,
    markdownPayload,
    session,
    appComponents,
  } = input
  const injectAnalytics = shouldInjectAnalytics(app.analytics, page.path)
  const sessionTimeout = extractSessionTimeout(app.analytics)
  const html = renderToString(
    <DynamicPage
      page={page}
      badgeEnabled={isBadgeEnabled(app.badge)}
      demoNoticeEnabled={!isOperatorConsoleApp(app)}
      components={appComponents}
      theme={app.theme}
      languages={app.languages}
      tables={app.tables}
      buckets={app.buckets}
      landingPath={app.auth?.landingPath}
      detectedLanguage={detectedLanguage}
      urlLanguage={urlLanguage}
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
  /** P9: the host page's active language, forwarded to `resolveAndFilterPage`. */
  readonly detectedLanguage?: string
  /** GAP-3: the host request query, forwarded to `resolveAndFilterPage`. */
  readonly requestQuery?: Readonly<Record<string, string>>
  /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
  readonly urlLanguage?: string
}): Promise<
  Page | { readonly unauthorized: true } | { readonly permissionBlocked: true } | undefined
> {
  const { matchedPage, app, routeParams, session, cookies, db, previewMode } = input
  // Pure pass-throughs to `resolveAndFilterPage` — the per-request locale and
  // query context, grouped so it reads as one thing.
  const { detectedLanguage, requestQuery } = input
  // [internal ref]: editorial-role preview bypasses
  // collection.filter so admins/editors can preview drafts at the
  // canonical public URL. The route layer guarantees `previewMode` is
  // only `true` for editorial sessions, so the resolver does not need
  // to recheck the role here.
  //
  // Bug 2 / [internal ref]: when the matched page is a
  // collection page over a table with `rowLevelPermissions.read.when`,
  // build a per-request predicate so a row the user can't see returns
  // `permission-blocked` (a distinct outcome from `not-found`) and the
  // caller renders a structured access-denied response instead of a
  // silent 404. Anonymous sessions skip the predicate (the page guard
  // already 404'd them earlier).
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
  // GAP-I2: a collection page resolves its host record here (not via
  // `resolvePageParentRecord`, which only handles `dataSource: single`).
  // Thread it so config-editor `inlinePrefill` `$record.*` tokens resolve
  // against the collection record.
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
    ...(requestQuery !== undefined ? { requestQuery } : {}),
    urlLanguage: input.urlLanguage,
  })
}

/**
 * Bug 2 / [internal ref]: build the row-level-read predicate
 * passed to `resolveCollectionPage`. Returns `undefined` when there is
 * nothing to check (no `collection`, no table found, no
 * `rowLevelPermissions.read.when`) so the resolver runs the existing
 * pass-through path.
 *
 * Admins / unrestricted sessions short-circuit to `true` — the table-level
 * row-level guard already lets admins see every row, and pages mirror that
 * for consistency.
 */
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
  const isAdmin = session.isUnrestricted === true || isAdminRole(session.role)
  if (isAdmin) return undefined
  return async (record) => {
    // Collect scope-tables referenced by the predicate (typically just
    // the bound table, but the helper handles `$currentUser.assignments.X`
    // referencing any scope).
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

/**
 * Extract `$currentUser.assignments.<table>` slug references from a
 * row-level predicate value. Supports both the typed object form
 * (`{ kind: 'currentUser', path: { kind: 'assignment', tableSlug } }`)
 * and the string template form (`'$currentUser.assignments.X'`).
 *
 * Mirrors the application-layer `collectAssignmentScopeTables` helper but
 * stays in the presentation layer because the resolver runs there.
 */
/** Extract `tableSlug` from the typed `{ kind: 'currentUser', path: ... }` form. */
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

/** Extract `tableSlug` from the string-template form `$currentUser.assignments.<slug>`. */
function scopeFromTemplatePredicateValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const prefix = '$currentUser.assignments.'
  if (!value.startsWith(prefix)) return undefined
  const slug = value.slice(prefix.length)
  return slug.length > 0 ? slug : undefined
}

function collectScopeTablesFromPredicate(predicate: RowLevelWhen): readonly string[] {
  // GAP-3: a composite group references scope tables across all conditions.
  if (isPredicateGroup(predicate)) {
    return predicate.conditions.flatMap(collectScopeTablesFromPredicate)
  }
  const fromTemplate = scopeFromTemplatePredicateValue(predicate.value)
  if (fromTemplate !== undefined) return [fromTemplate]
  const fromTyped = scopeFromTypedPredicateValue(predicate.value)
  if (fromTyped !== undefined) return [fromTyped]
  return []
}

/**
 * Fetch user_access record-id lists for every scope-table referenced by
 * the row-level predicate, in parallel. Silently degrades to "no
 * assignments" when a read fails — the evaluator then sees an empty list
 * and the predicate fails (safer than allowing).
 */
async function loadAssignmentsForScopes(
  userId: string,
  scopeTables: readonly string[],
  db: DataSourceDb
): Promise<ReadonlyMap<string, readonly string[]>> {
  if (scopeTables.length === 0) {
    return new Map<string, readonly string[]>()
  }
  const { fetchUserAssignments: fetchAssignments } = db
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
  /**
   * GAP-I2: the host record of a collection page (already resolved by
   * `resolveCollectionPage`). Used as the `parentRecord` for config-editor
   * `inlinePrefill` resolution when the page has no `dataSource: single`.
   */
  readonly collectionRecord?: Readonly<Record<string, unknown>>
  /**
   * P9: the host page's active language (the `/:lang/` URL prefix →
   * `detectedLanguage`). Threaded into `applyPageComponentFilters` so an
   * embedded `formRef` resolves its `$t:` strings against the same locale as
   * the rest of the page.
   */
  readonly detectedLanguage?: string
  /**
   * GAP-3 / [internal ref]: the host page's request query string, threaded into
   * `applyPageComponentFilters` so an embedded `formRef`'s `$query` prefill
   * resolves against the host page URL.
   */
  readonly requestQuery?: Readonly<Record<string, string>>
  /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
  readonly urlLanguage?: string
}): Promise<Page | { readonly unauthorized: true } | undefined> {
  const { rawPage, app, routeParams, session, cookies, db, collectionRecord } = input
  // Pure pass-throughs to `applyPageComponentFilters` — grouped so the request
  // context reads as one thing rather than three unrelated locals.
  const { detectedLanguage, requestQuery, urlLanguage } = input

  // Y-5: Resolve the page-level `dataSource: { mode: 'single' }` (if any)
  // before component filters run so `expandFormRefs` can resolve
  // `inlinePrefill` tokens like `$parent.id` against the host record. The
  // resolution is independent of `resolvePageDataSources` because that
  // function operates on per-component bindings, while inline-create
  // needs the host page's record visible to all descendant form-refs.
  const parentResolution = await resolvePageParentRecord(rawPage, routeParams, db)
  if (parentResolution.kind === 'not-found') return undefined

  // The single-mode dataSource record takes precedence; otherwise fall back
  // to the collection record (GAP-I2) so editor `$record.*` tokens resolve.
  const hostRecord = parentResolution.kind === 'record' ? parentResolution.record : collectionRecord

  // CAP-2: distribute the page-level single record to descendant `$record.*` —
  // server-side for the DB `{ table, mode: single }` binding, or via a client-side
  // `page-record-system` enhancer marker for the `{ system }` detail binding.
  const boundPage = applyPageLevelRecordBinding(rawPage, routeParams, hostRecord)

  const filteredPage = applyPageComponentFilters({
    rawPage: boundPage,
    app,
    session,
    parentRecord: hostRecord,
    detectedLanguage,
    requestQuery,
    urlLanguage,
  })

  // B2: resolve every `select` option-source binding into a concrete `options`
  // array BEFORE the rows-oriented walk below. The pass also REMOVES the
  // binding, which is what keeps `resolveComponent` — it keys off
  // `component.dataSource` — from sweeping a choice control into
  // `resolveByMode` and mangling it as a record-rendering component.
  const withSelectOptions = await resolveSelectOptionSources(filteredPage, {
    app,
    session,
    cookies,
    db,
  })

  const resolved = await resolvePageDataSources(withSelectOptions, app, routeParams, {
    session,
    cookies,
    db,
  })
  if (resolved === undefined) return undefined
  if ('unauthorized' in resolved) return { unauthorized: true }
  return resolveCustomHtmlSources(resolved)
}

/**
 * Bug 2 / [internal ref]: overlay `system.user_access` roles
 * onto the request session before any access check fires, mirroring the
 * table-level Z-3 pattern in `row-level-guard.ts`. A user with Better
 * Auth role `member` but a `user_access` row of `role: 'engineer'`
 * passes a page guard of `access: ['engineer']`. The overlay only fires
 * when both the db adapter AND the session are present so anonymous
 * requests stay on the existing path. Extracted from `renderPageByPath`
 * to keep that function under the max-lines-per-function cap.
 */
async function resolveOverlayedSession(
  rawSession: SessionInfo | undefined,
  db: DataSourceDb | undefined
): Promise<SessionInfo | undefined> {
  if (!rawSession) return undefined
  return overlayUserAccessRoles(rawSession, db ?? noopDb)
}

// eslint-disable-next-line complexity, max-lines-per-function -- composed access guard (page access + formRef gate + landing redirect + collection resolution + permission overlay)
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
    /** GAP-3 / [internal ref]: host request query for embedded `$query` prefill. */
    readonly requestQuery?: Readonly<Record<string, string>>
    /**
     * [internal ref]..039: the `/:lang/` URL-prefix locale, when the request
     * carried one. Distinct from `detectedLanguage` (which also carries the
     * browser `Accept-Language` guess) because only the URL prefix outranks a
     * page's own `meta.lang`.
     */
    readonly urlLanguage?: string
  }
): Promise<PageRenderResult> {
  const {
    detectedLanguage,
    session: rawSession,
    cookies,
    db,
    islandBuilder,
    previewMode,
    requestQuery,
    urlLanguage,
  } = options ?? {}
  const found = findPageForPath(app, path)
  if (!found) return undefined
  const { page: matchedPage, params: routeParams, indexBasePathPattern } = found

  const session = await resolveOverlayedSession(rawSession, db)

  // Page access first, then [internal ref] formRef gates (404 — S1).
  const denied = toAccessDeniedResult(checkPageAccess(matchedPage.access, app, session, path))
  if (denied !== false) return denied
  if (evaluateEmbeddedFormRefsAccess(app, matchedPage, session) === 'denied') return undefined

  // Post-login landing resolver — runs only for the configured `auth.landingPath`
  // and only after the access guard has already bounced anonymous visitors.
  const landingRedirect = await resolveLandingRedirect(app, path, session, db)
  if (landingRedirect !== undefined) return landingRedirect

  // Collection-page resolution is fused
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
    ...(detectedLanguage !== undefined ? { detectedLanguage } : {}),
    ...(requestQuery !== undefined ? { requestQuery } : {}),
    ...(urlLanguage !== undefined ? { urlLanguage } : {}),
  })
  if (resolvedPage === undefined) return undefined
  if ('unauthorized' in resolvedPage) return { unauthorized: true }
  // Bug 2 / [internal ref]: the slug existed but row-level read
  // perms exclude it for this user. Render a minimal 200 access-denied
  // page (the spec accepts either 200 with an access marker OR 403; 200 +
  // marker matches the existing PageRenderResult shape).
  if ('permissionBlocked' in resolvedPage) {
    return renderPermissionBlockedPage(app, detectedLanguage)
  }
  const page: Page = resolvedPage

  // [internal ref]: a contentDir page whose requested slug has no
  // backing markdown file (in an existing collection directory) is a genuine
  // not-found — return undefined so the caller renders the 404 not-found page
  // instead of an empty 200 article shell.
  if (await isContentDirSlugNotFound(page, routeParams)) return undefined

  // [internal ref]..033 / [internal ref]: highlight every `code`
  // component BEFORE `renderToString`, so a block nested inside a `tabs` panel
  // survives the island's `renderToStaticMarkup` serialisation already
  // highlighted (a post-render splice cannot reach into an escaped attribute).
  const [
    resolvedSidebar,
    islandEntryFile,
    markdownPayload,
    highlightedComponents,
    highlightedTemplates,
  ] = await Promise.all([
    resolvePageSidebar(page.layout?.sidebar, app, { session, cookies, db: db ?? noopDb }),
    resolveIslandEntryFile(page, app.components, islandBuilder),
    resolveMarkdownPage(page, routeParams, app, detectedLanguage, indexBasePathPattern),
    resolvePageCodeHighlights(page.components, app.theme?.codeBlock?.theme),
    resolveComponentsCodeHighlights(app.components, app.theme?.codeBlock?.theme),
  ])
  const pageHtml = renderPageHtml({
    app,
    page: { ...page, components: highlightedComponents },
    appComponents: highlightedTemplates,
    routeParams,
    detectedLanguage,
    urlLanguage,
    islandEntryFile,
    resolvedSidebar,
    markdownPayload,
    session,
  })
  // [internal ref]..033: a standalone `code` component emits a synchronous
  // pre-highlight placeholder (Shiki's dynamic import can't run inside
  // `renderToString`). This async pass splices in the Shiki class-based markup,
  // reading the theme from `theme.codeBlock.theme`. A no-op for pages without
  // `code` components.
  return highlightComponentCodeBlocks(pageHtml, app.theme?.codeBlock?.theme)
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
    /** GAP-3 / [internal ref]: host request query for embedded `$query` prefill. */
    readonly requestQuery?: Readonly<Record<string, string>>
    /** [internal ref]..039: the `/:lang/` URL-prefix locale, when present. */
    readonly urlLanguage?: string
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
