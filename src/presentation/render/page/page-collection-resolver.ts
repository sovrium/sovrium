/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turning the DECLARED page into the one this request is about, and deciding
 * whether this caller may see the row it names.
 *
 * Two halves, and they belong together because the second is an argument to the
 * first: `prepareRequestPage` runs the route-bound-table pass and the four
 * `$`-substitution passes, then `resolveCollectionAndFilter` hands
 * `resolveCollectionPage` a row-level read predicate built from the table's own
 * `rowLevelPermissions.read.when`. A slug that resolves to a row this caller
 * cannot read is `permission-blocked` rather than `not-found` — a distinction
 * only a resolver holding both halves can draw.
 *
 * Named for the page shape it resolves; the record-level resolver it calls is
 * `render/resolve/page-collection-resolver.ts`, which is a different question
 * (which ROW does this slug name?) asked one layer down.
 */

import { resolvePageWindow } from '@/domain/models/app/pages/window-props'
import {
  stripRestrictedColumns,
  type TableLike,
} from '@/domain/models/app/tables/read-access-plan-service'
import { resolveActiveMarkers } from '@/presentation/render/resolve/active-marker-resolver'
import { resolvePageAppVars } from '@/presentation/render/resolve/app-vars-resolver'
import { resolveRenderPlan } from '@/presentation/render/resolve/data-source-modes'
import { resolveCollectionPage } from '@/presentation/render/resolve/page-collection-resolver'
import { resolvePageQueryProps } from '@/presentation/render/resolve/query-props-resolver'
import {
  rowLevelCheckForVisitor,
  type RowLevelReadCheck,
} from '@/presentation/render/resolve/record-read-gate'
import { resolveRouteBoundTables } from '@/presentation/render/resolve/route-bound-table-resolver'
import { resolvePageRouteParams } from '@/presentation/render/resolve/route-param-props-resolver'
import { resolveTabsLazyPanels } from '@/presentation/render/resolve/tabs-lazy-resolver'
import { resolvePageWindowProps } from '@/presentation/render/resolve/window-props-resolver'
import { definedOnly, resolveAndFilterPage } from './page-row-scope-resolver'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'
import type { SystemRecordFetcher } from '@/presentation/render/resolve/page-system-record-binding'

/**
 * Turn the DECLARED page into the one this request is actually about.
 *
 * Five passes, and the order between the first and the rest is load-bearing.
 *
 *  - **P7** binds a grid to the table the URL names and derives that table's
 *    columns. It runs FIRST because the generic `$param` pass below would erase
 *    the very reference its 404 decision depends on: after substitution a
 *    route-bound table is indistinguishable from a literal one.
 *  - **P4 / G1 / P11 / P8** then substitute the declared `$query.<name>`
 *    values, the serving app's own `$app.*` facts, the resolved `$window.*`
 *    instants and the matched `$param.<name>` segments — so all four are usable
 *    anywhere a string is: a data-source filter, a `system.query` value or an
 *    action URL the resolution below is about to read, a set of island props it
 *    is about to serialise, a breadcrumb root label derived further down.
 *
 * The window is resolved ONCE, against a single `Date.now()`. A page whose
 * panels each read the clock would drift their windows apart by however long
 * the render took, and a surface reporting two periods at once invites the
 * operator to compare them.
 *
 * `'not-found'` is P7's answer to a segment naming no declared table: "this
 * table does not exist" and "this table is empty" must not look the same.
 */
function prepareRequestPage(input: {
  readonly matchedPage: Page
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  readonly session: SessionInfo | undefined
  readonly requestQuery?: Readonly<Record<string, string>>
  readonly hostApp?: App
  readonly requestOrigin?: string
  readonly basePath?: string
  readonly engineVersion?: string
}): Page | 'not-found' {
  const {
    matchedPage,
    app,
    routeParams,
    session,
    requestQuery,
    hostApp,
    requestOrigin,
    basePath,
    engineVersion,
  } = input
  const routeBound = resolveRouteBoundTables(matchedPage, app, routeParams, session)
  if (routeBound === 'not-found') return 'not-found'

  // R3 runs LAST, and that ordering is the whole primitive: `activeWhen.value`
  // is normally a `$`-reference, and the comparison is between LITERALS. Only
  // after the four substitution passes above — each of which walks every string
  // leaf, `activeWhen.value` included — is there anything to compare.
  return resolveActiveMarkers(
    resolvePageRouteParams(
      resolvePageWindowProps(
        resolvePageAppVars(
          // `resolveTabsLazyPanels` is nested INSIDE the query substitution
          // rather than run before the chain: it has to see
          // `defaultTab: '$query.tab'` while the binding is still a binding,
          // and the pass wrapping it is the one that replaces it with the
          // resolved value.
          resolvePageQueryProps(resolveTabsLazyPanels(routeBound), requestQuery),
          hostApp ?? app,
          requestOrigin,
          { basePath, engineVersion }
        ),
        resolvePageWindow(matchedPage.window, requestQuery, Date.now())
      ),
      routeParams
    )
  )
}

/**
 * The per-request context `resolveCollectionAndFilter` needs.
 *
 * A NAMED interface rather than an inline literal, matching its sibling
 * {@link ResolveAndFilterInput} below: fifteen members inline counted against
 * the function's own line cap, so every new pass-through field pushed the body
 * closer to a limit that has nothing to do with how much the function does.
 */
interface ResolveCollectionAndFilterInput {
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
  /** G1: the app whose own `$app.*` facts the page reads (a mount's host app). */
  readonly hostApp?: App
  /** G1: the request origin, the one `$app.*` fact only a request can answer. */
  readonly requestOrigin?: string
  /**
   * G1: the base this app is SERVED at, feeding `$app.basePath` — `''` for a
   * standalone app at the site root, `/_admin` or `/ops` for a mounted console.
   * The sibling of `requestOrigin`: the two are the halves of one address, and
   * a page composing `$app.origin$app.basePath/x` needs both to resolve.
   */
  readonly basePath?: string
  /**
   * G1: the version of the SOVRIUM ENGINE serving this render, feeding
   * `$app.engineVersion`. A process constant resolved once at boot — never a
   * config value, and under a mount never the same number as `$app.version`.
   */
  readonly engineVersion?: string
  /** P9: server-side reader for a SYSTEM-backed select option source. */
  readonly fetchSystemRows?: SystemRowsFetcher
  /** [internal ref]: server-side reader for a page-level `{ system }` record binding. */
  readonly fetchSystemRecord?: SystemRecordFetcher
  /**
   * P10/mount: the caller's resolved powers. A mounted console renders
   * session-less, so without this the capability gates are inert there — see
   * `holdsCapability` (`visibility-filter.ts`).
   */
  readonly callerCapabilities?: readonly CallerCapability[]
}

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
export async function resolveCollectionAndFilter(
  input: ResolveCollectionAndFilterInput
): Promise<
  Page | { readonly unauthorized: true } | { readonly permissionBlocked: true } | undefined
> {
  const { app, routeParams, session, cookies, db, previewMode } = input
  // P7 then the four `$`-reference passes, in one step — see
  // `prepareRequestPage`. `'not-found'` is the route-bound-table 404.
  const matchedPage = prepareRequestPage(input)
  if (matchedPage === 'not-found') return undefined
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
  // silent 404. The table-read and field-read halves ride with it — see
  // `collectionReadGateOf`.
  const collectionResolution = await resolveCollectionPage(matchedPage, routeParams, db, {
    bypassFilter: previewMode,
    ...collectionReadGateOf(matchedPage, app, session, db),
  })
  if (collectionResolution.kind === 'not-found') return undefined
  if (collectionResolution.kind === 'permission-blocked') return { permissionBlocked: true }
  const rawPage = collectionResolution.kind === 'match' ? collectionResolution.page : matchedPage
  // A collection page resolves its host record here (not via
  // `resolvePageParentRecord`, which only handles `dataSource: single`).
  // Thread it so an embedded form's `inlinePrefill` `$record.*` tokens
  // resolve against the collection record.
  const collectionRecord =
    collectionResolution.kind === 'match' ? collectionResolution.record : undefined
  return resolveAndFilterPage({
    rawPage,
    app,
    routeParams,
    session,
    cookies,
    db,
    // `definedOnly` rather than five inline `...(x !== undefined ? …)` spreads:
    // `exactOptionalPropertyTypes` forces one per optional member, and five of
    // them is a branch each, which alone pushed this function past its
    // complexity cap.
    ...definedOnly({
      collectionRecord,
      detectedLanguage,
      requestQuery,
      fetchSystemRows: input.fetchSystemRows,
      fetchSystemRecord: input.fetchSystemRecord,
      hostApp: input.hostApp,
      callerCapabilities: input.callerCapabilities,
    }),
    urlLanguage: input.urlLanguage,
  })
}

/**
 * The records API's three read gates, as the option bag `resolveCollectionPage`
 * applies to the collection record — the same three, in the same order, that
 * `gateRecordForCaller` (`record-read-gate.ts`) applies to every other record a
 * page resolves:
 *
 *  1. **table read** refused — the visitor may read no row of this table, so
 *     every slug answers `refuseRecord` (404, S1). The page's own `access` does
 *     not stand in for it: a public page over a table the visitor may not read
 *     printed the whole row, where the records API gives them nothing.
 *  2. **row-level read** — for a signed-in visitor, the predicate whose `false`
 * is the 200 access-denied page. An anonymous
 *     visitor on a row-scoped table has no user to evaluate it against, so the
 *     table is refused outright rather than every row answering "access
 *     denied" — which would confirm each slug exists.
 *  3. **field read** — `projectRecord`, the record less its unreadable columns,
 *     applied before any `$record.*` or `$collection.*` token is substituted.
 *
 * An empty bag — the record used whole — when the page is not a collection page
 * or the app declares no `auth` (the full-access model).
 */
function collectionReadGateOf(
  page: Page,
  app: App,
  session: SessionInfo | undefined,
  db: DataSourceDb
): {
  readonly refuseRecord?: true
  readonly rowLevelReadCheck?: RowLevelReadCheck
  readonly projectRecord?: (
    record: Readonly<Record<string, unknown>>
  ) => Readonly<Record<string, unknown>>
} {
  if (page.collection === undefined) return {}
  const tableName = page.collection.table
  const table = app.tables?.find((t) => t.name === tableName) as TableLike | undefined
  const plan = resolveRenderPlan({ matchedTable: table, app, session })
  if (plan === undefined) return {}
  if (table === undefined || !plan.allowed) return { refuseRecord: true }
  const rowLevelReadCheck = rowLevelCheckForVisitor(table, session, db)
  if (rowLevelReadCheck !== undefined && session === undefined) return { refuseRecord: true }
  return {
    projectRecord: (record) => stripRestrictedColumns(plan, record),
    ...(rowLevelReadCheck !== undefined ? { rowLevelReadCheck } : {}),
  }
}
