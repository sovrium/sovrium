/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Page-level single-record `$record.*` distribution (CAP-2).
 *
 * A page-level `dataSource` binds the host PAGE itself to a single record, then
 * exposes it as `$record.*` to the page's descendant components. CAP-2 widens that
 * binding to a discriminated union:
 *  - `{ table, mode: 'single', param }` — the DB record is resolved SERVER-side
 *    (`resolvePageParentRecord` → `db.fetchSingleRecord`); this module substitutes
 *    its `$record.*` tokens into the page components server-side, so the page ships
 *    with the values already in the SSR HTML.
 *  - `{ system }` — the record lives behind a guarded detail endpoint; this module
 *    reads it SERVER-side through the injected `fetchSystemRecord` and substitutes
 *    it the same way, falling back to a `page-record-system` enhancer marker (which
 *    fetches CLIENT-side and rewrites the SSR text nodes in place) only when no
 *    fetcher was injected.
 *
 * ─── THE `{ system }` ARM RESOLVES SERVER-SIDE ──────────────────
 *
 * This header used to say, of the `{ system }` arm, that the record "cannot be
 * resolved server-side". That was true when it was written and stopped being
 * true when `route-setup/system-rows-fetcher.ts` shipped: a reader that calls
 * our own API ON THE RENDER PATH with the caller's identity headers borrowed,
 * threaded into BOTH render funnels — the operator page route and the
 * mounted-app route. `page.redirectToFirst` and the system option source
 * already spend it, and `systemRecordFetcher` is that same reader against
 * `recordKey` instead of `rowsKey`.
 *
 * So both arms of one binding now reach the same outcome: the record is in the
 * FIRST response, and a route param naming no record is the page's own 404
 * rather than a 200 whose heading reads `$record.title`.
 *
 * THE READ BORROWS THE CALLER'S IDENTITY. Reading the endpoint with the
 * server's own authority would look identical on the page that motivated this
 * and would publish an admin-only record to anonymous visitors. The fetcher
 * forwards the caller's session, so an endpoint that refuses this caller makes
 * the page 404 for them (S1: 404, never 401/403).
 *
 * THE CLIENT MARKER REMAINS THE FALLBACK for a render with NO fetcher — a
 * static build, or any caller with no HTTP context. When the server did resolve
 * the record the marker is not emitted at all, because leaving it mounted costs
 * every visitor a duplicate authenticated read of a record already in the HTML
 * in front of them.
 *
 * Lives in its own module so `render-page.tsx` stays under the line cap and the
 * two-path contract is isolated.
 */

import { buildDetailEndpointUrl } from '@/domain/models/app/pages/system-detail-endpoint'
import { substituteRecordInCollectionTemplate } from '@/presentation/render/resolve/data-source-rows'
import { autoBindCommentComponents } from '@/presentation/render/resolve/page-collection-resolver'
import { filterChildrenForRecord } from '@/presentation/render/resolve/record-visibility'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

/** The loose shape of a page-level dataSource after the CAP-2 union widening. */
interface PageLevelDataSource {
  readonly table?: string
  readonly mode?: string
  readonly param?: string
  readonly system?: SystemDetailSource
}

/**
 * The empty `page-record-system` enhancer marker appended to a system-bound page.
 * Carries the detail-endpoint binding plus the route param value injected into the
 * `:param` slot; the island fetches the record and distributes `$record.*` into the
 * page's SSR text nodes. Mirrors the admin run-detail pane's `data-island` container.
 */
function buildPageSystemMarker(
  system: SystemDetailSource,
  routeParams: Readonly<Record<string, string>>
): Component {
  const paramName = system.param ?? 'id'
  const recordId = routeParams[paramName] ?? ''
  return {
    type: 'container',
    element: 'div',
    props: {
      'data-island': 'page-record-system',
      'data-island-props': JSON.stringify({ system, recordId }),
    },
  } as unknown as Component
}

/**
 * Distribute the page's record into its component tree.
 *
 * `substituteRecordInCollectionTemplate` and NOT `substituteRecordInComponent`,
 * and the difference is the whole reason a page may carry a record AND a rows
 * binding at once. The collection variant leaves the CHILDREN of a
 * `dataSource`-bearing node untouched; the plain one recurses into everything.
 *
 * A page's own record and a nested rows binding are two `$record` NAMESPACES.
 * Under the plain walk the page record wins the race — it runs before
 * `expandSystemRowTemplates` — and every `$record.<field>` in the row template
 * resolves against the PAGE record instead. The failure is silent and total:
 * `substituteRecordVars` renders an unknown field as the EMPTY STRING, so the
 * row template's tokens are erased before the expansion that would have filled
 * them, and the rows render blank. Nothing throws, nothing logs, and the page
 * looks built.
 *
 * The collection-page resolver made this exact call for the DB arm already, for
 * the same reason and in the same words ("those children are per-row templates
 * that must be expanded against each fetched record"). This is that decision
 * applied to the system arm, which is what lets the MCP console page print its
 * resolved origin from the page record and its tool rows from
 * `/api/admin/mcp/tools` on one page.
 *
 * A `dataSource`-bearing node's OWN props and content are still substituted —
 * only its children are skipped — so a bound component whose `props` name the
 * page record keeps working.
 *
 * ─── THE TOP-LEVEL ARRAY IS FILTERED, NOT ONLY MAPPED ─────────────────────
 *
 * `filterChildrenForRecord` runs over `page.components` FIRST, for the same
 * reason it runs at every level inside the walk: `visibility.record` on a
 * top-level section reads the one record the page is bound to, exactly as it
 * does one level down. Mapping without filtering is what made the gate fire on
 * a section's children while the section holding them was silently kept — the
 * hardest shape of failure to see, because the half that works looks like proof
 * that the whole thing does.
 *
 * The consequence is not a convenience. A detail page has no `if`, so a section
 * with nothing to put in it can only be OMITTED or drawn empty; without this
 * filter it was always drawn empty.
 *
 * A node whose predicate fails is dropped from the document rather than hidden,
 * which is the same contract the row path already keeps: a reader's find-in-page
 * must not turn up a section the record does not have.
 */
function substitutePageComponents(
  components: Page['components'],
  record: Readonly<Record<string, unknown>>,
  tableName: string | undefined
): Page['components'] {
  if (!components) return components
  const visible = filterChildrenForRecord(
    components as readonly (Component | string)[],
    record
  ) as Page['components']
  if (!visible) return visible
  return visible.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return substituteRecordInCollectionTemplate(
      item as Component,
      record as Record<string, unknown>,
      tableName
    )
  })
}

/**
 * The renderer's server-side single-record reader, injected per request.
 *
 * Mirrors `SystemRowsFetcher`: absent means "this render has no HTTP context"
 * (a static build, a unit test), which degrades to the client marker rather
 * than to a 404 — a build-time render has no caller whose 404 it could be.
 * `undefined` from the fetcher itself is the opposite: a caller who exists and
 * for whom the record does not.
 */
export type SystemRecordFetcher = (
  endpoint: string,
  recordKey: string | undefined
) => Promise<Readonly<Record<string, unknown>> | undefined>

/** The page as bound, or the page's own 404. */
export type PageRecordBinding =
  { readonly kind: 'page'; readonly page: Page } | { readonly kind: 'not-found' }

/**
 * Resolve the `{ system }` arm: read the record as the caller, substitute it,
 * and emit NO enhancer marker — the tokens are already filled.
 *
 * Without a fetcher the marker is appended instead, which is the pre-[internal ref]
 * behaviour and the only thing a context-less render can do.
 */
async function bindSystemRecord(
  page: Page,
  system: SystemDetailSource,
  routeParams: Readonly<Record<string, string>>,
  fetchSystemRecord: SystemRecordFetcher | undefined
): Promise<PageRecordBinding> {
  if (fetchSystemRecord === undefined) {
    const marker = buildPageSystemMarker(system, routeParams)
    return { kind: 'page', page: { ...page, components: [...(page.components ?? []), marker] } }
  }
  const recordId = routeParams[system.param ?? 'id'] ?? ''
  const record = await fetchSystemRecord(buildDetailEndpointUrl(system, recordId), system.recordKey)
  // Refused, absent, or naming nothing — all three are the page's own 404, and
  // are deliberately not told apart (S1, anti-enumeration). The DB arm already
  // answers a row it cannot find this way.
  if (record === undefined) return { kind: 'not-found' }
  return {
    kind: 'page',
    page: { ...page, components: substitutePageComponents(page.components, record, undefined) },
  }
}

/**
 * Auto-bind the page's own record onto any `comments` component below it.
 *
 * The `comments` schema documents `recordId` as "auto-resolved to `$record.id`
 * by default", and that convention is about the PAGE being bound to one record
 * rather than about which of the two bindings reached it — so the pass the
 * `collection` arm has always run belongs here too. Shared with
 * `resolveCollectionPage` rather than restated, so the two arms cannot drift.
 *
 * A record with no readable `id` is left alone: an auto-bind onto `"undefined"`
 * would fetch a record that cannot exist and turn a silent empty thread into a
 * silent wrong one.
 */
function bindComments(
  components: Page['components'],
  record: Readonly<Record<string, unknown>>,
  ds: PageLevelDataSource
): Page['components'] {
  const recordId = record['id']
  if (recordId === undefined || recordId === null) return components
  return autoBindCommentComponents(components, ds.table, String(recordId))
}

/**
 * Apply a page-level single-record binding to a page before component filters run.
 *
 * - `{ system }` → read the record as the CALLER and substitute `$record.*`
 *   server-side; 404 when there is none; the client marker only without a fetcher.
 * - `{ table, mode: 'single', param }` (with `hostRecord` already resolved) →
 *   substitute `$record.*` into the page components server-side.
 *
 * Any other page (no page-level dataSource, list/search mode, or a collection page
 * whose record was substituted by `resolveCollectionPage`) passes through unchanged.
 */
export async function applyPageLevelRecordBinding(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  hostRecord: Readonly<Record<string, unknown>> | undefined,
  fetchSystemRecord?: SystemRecordFetcher
): Promise<PageRecordBinding> {
  const ds = page.dataSource as PageLevelDataSource | undefined
  if (ds?.system !== undefined) {
    return bindSystemRecord(page, ds.system, routeParams, fetchSystemRecord)
  }
  if (ds?.mode === 'single' && hostRecord !== undefined) {
    const components = substitutePageComponents(page.components, hostRecord, ds.table)
    return { kind: 'page', page: { ...page, components: bindComments(components, hostRecord, ds) } }
  }
  return { kind: 'page', page }
}
