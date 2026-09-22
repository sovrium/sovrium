/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flattenRecordFields } from '@/domain/models/app/pages/record-envelope'
import type { Page } from '@/domain/models/app/pages'
import type { PageParamProp } from '@/domain/models/app/pages/params'
import type { SystemRowsFetcher } from '@/presentation/render/resolve/first-object-redirect-resolver'

/** Envelope defaults, shared with every other rows consumer. */
const DEFAULT_ROWS_KEY = 'items'
const DEFAULT_ID_KEY = 'id'

/**
 * Decide whether this request's segments are ones the page says it serves.
 *
 * ─── WHY THIS RUNS BEFORE ANY RENDERING ────────────────────────────────────
 *
 * `page.params` is the page's statement of which URLs exist, so it answers the
 * question every other step assumes has already been answered: does this
 * address name a page at all? A segment outside the declared set is not a page
 * that renders empty — it is a page that was never served, and the two must not
 * look the same (rule S1, and the reason `route-bound-table-resolver` 404s an
 * undeclared table rather than drawing an empty grid).
 *
 * ─── WHY AN UNREADABLE SOURCE FAILS CLOSED ─────────────────────────────────
 *
 * Every unresolved case — no fetcher, a read that threw, an endpoint the caller
 * may not see, an envelope with no rows — resolves to an EMPTY set, and an empty
 * set serves nothing. The direction is the point: an allow-list is a statement
 * about which URLs exist, so a page that cannot evaluate it does not know that
 * this URL exists. Answering 200 instead would mean a withdrawn endpoint
 * silently unlocks every segment, which is precisely the failure a constraint is
 * written to prevent. The cost is that a broken source takes the route down, and
 * that is loud rather than silent.
 *
 * ─── THE READ IS DEDUPED ───────────────────────────────────────────────────
 *
 * Two parameters of one path may name the same source, and a page's own
 * components routinely bind the very endpoint its segment was checked against —
 * the component-type kit page reads the catalogue once to vouch for `:type` and
 * again to draw the card. {@link readEachSourceOnce} collapses the first of
 * those; the second is the component's own binding and stays its own read,
 * because it carries that component's sort and filter parameters and is
 * therefore not the same request.
 */
export async function routeParamsAreServed(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  fetchSystemRows: SystemRowsFetcher | undefined
): Promise<boolean> {
  const { params } = page
  if (params === undefined) return true
  // A parameter the matched path did not supply is not this request's business.
  // The name/path cross-check is a decode-time rule
  // (`routeParamAllowListViolations`), so this filter is inert in a booted app;
  // it keeps an unasked question from being answered with a refusal.
  const asked = Object.entries(params).filter(([name]) => routeParams[name] !== undefined)
  if (asked.length === 0) return true
  if (fetchSystemRows === undefined) return false

  const reads = await readEachSourceOnce(asked, fetchSystemRows)
  return asked.every(([name, prop]) => {
    const rows = reads.get(sourceReadOf(prop).key) ?? []
    const valueKey = prop.valueKey ?? prop.system.idKey ?? DEFAULT_ID_KEY
    return rows.some((row) => segmentOf(row, valueKey) === routeParams[name])
  })
}

/** One resolved read request, and the key two parameters share when they name it. */
interface SourceRead {
  readonly key: string
  readonly endpoint: string
  readonly rowsKey: string
}

const sourceReadOf = (prop: PageParamProp): SourceRead => {
  const endpoint = withStaticQuery(prop.system.endpoint, prop.system.query)
  const rowsKey = prop.system.rowsKey ?? DEFAULT_ROWS_KEY
  return { key: `${endpoint}\u0000${rowsKey}`, endpoint, rowsKey }
}

/**
 * Fetch every DISTINCT source once, in parallel, into an immutable map.
 *
 * Distinct rather than per-parameter because a two-segment path constrained
 * against one catalogue would otherwise read it twice for one request, and the
 * second read can only ever agree with the first.
 */
async function readEachSourceOnce(
  asked: ReadonlyArray<readonly [string, PageParamProp]>,
  fetchSystemRows: SystemRowsFetcher
): Promise<ReadonlyMap<string, readonly Record<string, unknown>[]>> {
  const requested = asked.map(([, prop]) => sourceReadOf(prop))
  const distinct = requested.filter(
    (read, index) => requested.findIndex((other) => other.key === read.key) === index
  )
  const rows = await Promise.all(
    distinct.map(async ({ key, endpoint, rowsKey }) => {
      const read = await fetchSystemRows(endpoint, rowsKey).catch(
        (): readonly Record<string, unknown>[] => []
      )
      return [key, read] as const
    })
  )
  return new Map(rows)
}

/**
 * The segment value one row admits, or `undefined` when it admits none.
 *
 * `valueKey` falls back to the envelope's `idKey` because a row's identity is
 * the value a URL most often names — and declaring it is what makes a catalogue
 * keyed by `type` addressable by that literal rather than by a number nobody
 * links to.
 *
 * The row is FLATTENED first, so `/api/tables/:t/records` — whose fields live in
 * a nested bag — is read the same way as an admin endpoint's flat rows. Without
 * it a `valueKey` naming a user field would resolve to nothing on every row, the
 * set would be empty, and every segment of a perfectly healthy route would 404.
 */
function segmentOf(row: Readonly<Record<string, unknown>>, valueKey: string): string | undefined {
  const value = flattenRecordFields(row)[valueKey]
  return value === null || value === undefined ? undefined : String(value)
}

/**
 * Append the source's STATIC query parameters to its endpoint.
 *
 * Built on the string rather than through `URL` because the endpoint is a
 * ROOT-RELATIVE path with no origin at this layer; the fetcher resolves it
 * against the request URL. Values are percent-encoded, so a parameter carrying
 * a `&` cannot inject a second one.
 */
function withStaticQuery(
  endpoint: string,
  query: Readonly<Record<string, string | number | boolean>> | undefined
): string {
  if (query === undefined) return endpoint
  const entries = Object.entries(query)
  if (entries.length === 0) return endpoint
  const search = entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
  return `${endpoint}${endpoint.includes('?') ? '&' : '?'}${search}`
}
