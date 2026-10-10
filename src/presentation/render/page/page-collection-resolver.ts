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
 * cannot read answers exactly as a slug naming no row: the page's own 404, so
 * the status tells her nothing the records API would not.
 *
 * Named for the page shape it resolves; the record-level resolver it calls is
 * `render/resolve/page-collection-resolver.ts`, which is a different question
 * (which ROW does this slug name?) asked one layer down.
 */

import { resolvePageWindow } from '@/domain/models/app/pages/window-props'
import { serverNow } from '@/domain/models/process-env/dev-clock'
import { resolveActiveMarkers } from '@/presentation/render/resolve/active-marker-resolver'
import { resolvePageAppVars } from '@/presentation/render/resolve/app-vars-resolver'
import { resolvePageInvitation } from '@/presentation/render/resolve/invitation-resolver'
import { resolveCollectionPage } from '@/presentation/render/resolve/page-collection-resolver'
import { resolvePageQueryProps } from '@/presentation/render/resolve/query-props-resolver'
import {
  callerRecordGateOf,
  readRowsForCaller,
  type CallerRowsQuery,
  type RowLevelReadCheck,
} from '@/presentation/render/resolve/record-read-gate'
import { resolveRouteBoundTables } from '@/presentation/render/resolve/route-bound-table-resolver'
import { resolvePageRouteParams } from '@/presentation/render/resolve/route-param-props-resolver'
import { resolveTabsLazyPanels } from '@/presentation/render/resolve/tabs-lazy-resolver'
import { resolvePageTwoFactorAttempt } from '@/presentation/render/resolve/two-factor-attempt-resolver'
import { resolvePageWindowProps } from '@/presentation/render/resolve/window-props-resolver'
import { resolvePageLanguage } from './page-lang-resolver'
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
 * The window is resolved ONCE, against a single reading of the server clock
 * (`serverNow()`, which `SOVRIUM_DEV_CLOCK` pins on a development server). A page whose
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
  readonly requestPath?: string
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
    requestPath,
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
          { basePath, engineVersion, ...(requestPath !== undefined ? { path: requestPath } : {}) }
        ),
        resolvePageWindow(matchedPage.window, requestQuery, serverNow().getTime())
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
  /** [internal ref]: the host request query, forwarded to `resolveAndFilterPage`. */
  readonly requestQuery?: Readonly<Record<string, string>>
  /** The `/:lang/` URL-prefix locale, when present. */
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
  /**
   * The path the visitor asked for, feeding `$app.path` — decoded, without the
   * query string. On the page answering a missing address it is THAT address,
   * not the page's own `/404`.
   */
  readonly requestPath?: string
  /** P9: server-side reader for a SYSTEM-backed select option source. */
  readonly fetchSystemRows?: SystemRowsFetcher
  /** server-side reader for a page-level `{ system }` record binding. */
  readonly fetchSystemRecord?: SystemRecordFetcher
  /**
   * P10/mount: the caller's resolved powers. A mounted console renders
   * session-less, so without this the capability gates are inert there — see
   * `holdsCapability` (`visibility-filter.ts`).
   */
  readonly callerCapabilities?: readonly CallerCapability[]
}

/** The passes reading the request itself: the page's invitation, then its code forms. */
const resolveRequestBoundPasses = async (input: ResolveCollectionAndFilterInput): Promise<Page> =>
  resolvePageTwoFactorAttempt(await resolvePageInvitation(input.matchedPage, input), input)

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
): Promise<Page | { readonly unauthorized: true } | undefined> {
  const { app, routeParams, session, cookies, previewMode } = input
  // P7 then the four `$`-reference passes, in one step — see
  // `prepareRequestPage`. `'not-found'` is the route-bound-table 404.
  const invited = await resolveRequestBoundPasses(input)
  const matchedPage = prepareRequestPage({ ...input, matchedPage: invited })
  if (matchedPage === 'not-found') return undefined
  // Pure pass-throughs to `resolveAndFilterPage` — the per-request locale and
  // query context, grouped so it reads as one thing.
  const { detectedLanguage, requestQuery } = input
  // The page's served language rides on `db` to every `$record.` text site.
  const { lang } = resolvePageLanguage(
    matchedPage,
    app.languages,
    detectedLanguage,
    input.urlLanguage
  )
  const db = {
    ...input.db,
    recordText: { locale: lang, tables: app.tables, languages: app.languages },
  }
  // editorial-role preview bypasses
  // collection.filter so admins/editors can preview drafts at the
  // canonical public URL. The route layer guarantees `previewMode` is
  // only `true` for editorial sessions, so the resolver does not need
  // to recheck the role here.
  //
  // When the matched page is a collection page over a table with
  // `rowLevelPermissions.read.when`, build a per-request predicate: a row the
  // reader may not read answers as a missing one — the same 404 and the same
  // page, signed in or not, as the records API answers her. The table-read and
  // field-read halves ride with it — see `collectionReadGateOf`.
  const collectionResolution = await resolveCollectionPage(matchedPage, routeParams, db, {
    bypassFilter: previewMode,
    ...collectionReadGateOf(matchedPage, app, session, db),
  })
  if (
    collectionResolution.kind === 'not-found' ||
    collectionResolution.kind === 'permission-blocked'
  ) {
    return undefined
  }
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
 * applies to the collection record — asked through the one gate every record a
 * page resolves answers (`callerRecordGateOf`, `record-read-gate.ts`):
 *
 *  1. **table read** refused — the visitor may read no row of this table, so
 *     every slug answers `refuseRecord` (404, S1). The page's own `access` does
 *     not stand in for it: a public page over a table the visitor may not read
 *     printed the whole row, where the records API gives them nothing. An
 *     anonymous visitor on a table whose rows are scoped to the signed-in
 *     person is refused the same way, rather than every row answering "access
 *     denied" — which would confirm each slug exists.
 *  2. **row-level read** — the predicate whose `false` answers the slug as a
 *     missing row's 404.
 *  3. **field read** — `projectRecord`, the record less its unreadable columns,
 *     applied before any `$record.*` or `$collection.*` token is substituted.
 *
 * `readRows` reads the collection's `$collection.previous` / `.next` neighbours
 * through the records gate as well (`readRowsForCaller`). An empty bag when the
 * page is not a collection page.
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
  ) => Promise<Readonly<Record<string, unknown>>>
  readonly readRows?: (query: CallerRowsQuery) => Promise<readonly Record<string, unknown>[]>
} {
  if (page.collection === undefined) return {}
  const tableName = page.collection.table
  const gate = callerRecordGateOf({ app, tableName, session, db })
  if (gate.kind === 'refused') return { refuseRecord: true }
  return {
    projectRecord: gate.project,
    ...(gate.rowCheck !== undefined ? { rowLevelReadCheck: gate.rowCheck } : {}),
    readRows: async (query) =>
      (await readRowsForCaller({ app, tableName, session, db, query })).rows,
  }
}
