/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

/**
 * Shared system read-endpoint fetch (CAP-1 runtime root).
 *
 * The canonical "rows-envelope" read path for every rows-oriented data-bound
 * component (data-table + the list family: kanban / calendar / gallery / list /
 * data-timeline). It was first proven inline in `use-data-table-query.ts`; this
 * module extracts it verbatim so each list component speaks the SAME envelope
 * contract instead of re-implementing the fetch / normalization per island.
 *
 * Envelope contract (mirrors `SystemSourceSchema`):
 *  - fetch `system.endpoint` (merging `system.query` static params + any dynamic
 *    external-filter params + the read-side page / sort / search params) instead
 *    of `/api/tables/:t/records`;
 *  - normalize the `{ [rowsKey]: [...rows] }` response to `{ records, total }`:
 *    rows are read at `rowsKey` (default `'items'`), each row's id is mapped onto
 *    the canonical `id` key from `idKey` (default `'id'`), and `total` comes from
 *    `totalKey` when numeric (else rows length);
 *  - a system source is a READ source — write surfaces never accept it.
 *
 * Specialized sources (`chart` series-shaped / `kpi` scalar-shaped) keep their
 * own fetch helpers and deliberately do NOT use this module.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchResult {
  readonly records: readonly TableRecord[]
  readonly total: number
  /**
   * The search term the endpoint reports it ACTUALLY applied — the signal that
   * decides which layer filters (`appliedQuerySchema`, `src/domain/models/api/_shared/search.ts`).
   *
   * Tri-state, and the third state is the whole point:
   *
   * | value      | meaning                                        | grid must      |
   * |------------|------------------------------------------------|----------------|
   * | `'<term>'` | the server filtered on this term               | NOT re-filter  |
   * | `null`     | endpoint searches server-side, no term supplied | NOT re-filter  |
   * | `undefined`| the endpoint does NOT search                    | filter locally |
   *
   * `undefined` (the response omitted the key) is what keeps this shippable one
   * endpoint at a time: an endpoint that has not been taught `?q=` yet must have
   * its grid keep narrowing the page it holds. Gating on "is this a system
   * source" instead would break exactly those.
   *
   * The three endpoints this comment used to name — automation runs, form
   * submissions, connections — have all since been resolved, the first two by
   * applying `?q=` server-side and echoing `appliedQuery`, and connections by
   * establishing that its whole set is already in memory. The list is left
   * unnamed rather than re-enumerated: a roster of stragglers is stale the day
   * one of them is fixed, and a comment naming the wrong endpoints is worse than
   * one naming none.
   */
  readonly appliedQuery?: string | null
  /**
   * The endpoint's own "there is more behind this page" token, read from the
   * response's `nextCursor`.
   *
   * Present only when the endpoint both paginates by cursor AND has a further
   * page to serve. Absent means the feed ended — which is why the grid's
   * load-more affordance is derived from THIS value rather than declared in
   * config: only the endpoint knows whether more rows exist, and a button that
   * offers rows the server has already said do not exist is the same defect as
   * the page-number pager it replaces.
   *
   * The cursor-paginated admin endpoints (`…/automations/runs`,
   * `…/forms/submissions`, `…/buckets/:b/files`, `…/agents/conversations`) have
   * always shipped this key and report NO total; it was read off the wire and
   * discarded here, so the only paging param the client could send was `page=N`
   * — which those handlers' query allow-lists drop.
   */
  readonly nextCursor?: string
}

/**
 * Minimal pagination shape the system fetch needs (`pageIndex` is 0-based; the
 * endpoint receives the 1-based `page`). Decoupled from TanStack's
 * `PaginationState` so the list family (which has no TanStack table state) can
 * reuse the fetch with a plain `{ pageIndex: 0 }`.
 */
export interface SystemPagination {
  readonly pageIndex: number
  readonly pageSize?: number
}

/** The read-side params used to build a system-endpoint request. */
export interface SystemQueryInput {
  readonly system: SystemSource
  /** Dynamic params from an external filter bar (merged over `system.query`). */
  readonly systemQuery?: Record<string, string>
  readonly pagination: SystemPagination
  readonly sortParam?: string
  readonly globalFilter?: string
  /**
   * A CONTINUATION token from a previous response's {@link FetchResult.nextCursor}.
   *
   * Present only on a "load more" request. When set, the request identifies its
   * position by `?cursor=` and sends NO `?page=` — the two are alternative
   * answers to the same question, and a cursor endpoint's allow-list drops
   * `page` silently, so sending both would re-serve page 1 under a cursor the
   * server never read.
   */
  readonly cursor?: string
}

export interface SystemFetchQuery extends SystemQueryInput {
  /**
   * The component id (`searchSourceId`). A NAMED grid bound to the
   * automation-runs endpoint opts into the localized run-status label mapping
   * below; anonymous sources (no `id`) keep their raw endpoint values so a
   * generic system source is never transformed.
   */
  readonly sourceId?: string
}

// ---------------------------------------------------------------------------
// Run-status localization (gated — inert without a NAMED runs grid)
// ---------------------------------------------------------------------------

/**
 * Localized run-status labels for the automation-runs read endpoint.
 *
 * The runs API surfaces the engine's terminal status verbatim
 * (`completed` / `failed` / `completed-with-errors`). When a NAMED directory
 * binds to that endpoint, the `status` field is mapped to its operator-facing
 * label here so the directory renders a readable status pill without a
 * server change or a per-column value-map in config. Gated on a NAMED source +
 * the runs endpoint so a generic / anonymous system source keeps its raw values
 * untouched.
 */
const RUN_STATUS_LABELS: Record<string, string> = {
  completed: 'Success',
  failed: 'Failed',
  'completed-with-errors': 'Partial',
}

function localizeRunStatusRows(
  endpoint: string,
  sourceId: string | undefined,
  rows: readonly TableRecord[]
): readonly TableRecord[] {
  if (!sourceId || !endpoint.includes('/automations/runs')) return rows
  return rows.map((row) => {
    const raw = row['status']
    if (typeof raw !== 'string') return row
    const label = RUN_STATUS_LABELS[raw]
    return label ? { ...row, status: label } : row
  })
}

// ---------------------------------------------------------------------------
// Query string + envelope normalization
// ---------------------------------------------------------------------------

/**
 * Build the merged query string for a system-endpoint request: static
 * `system.query` params first, then dynamic external-filter params (empty value
 * clears a param), then the read-side position / sort / search params.
 *
 * Two of those read-side params defer to what was already declared, because a
 * declaration that the layer below silently overwrites is a declaration that
 * does nothing:
 *
 *  - **position** — a {@link SystemQueryInput.cursor} REPLACES `page`. The
 *    cursor-paginated endpoints drop `page` from their allow-list, so sending
 *    both would ask by cursor and be answered by page 1.
 *  - **`limit`** — a static `system.query.limit` is the author naming this
 *    endpoint's page size, and it wins over the grid's own `pageSize`. It used
 *    to be set first and then unconditionally overwritten a few lines later,
 *    which made `query: { limit: '5' }` inert on every grid that did not also
 *    declare the identical `pagination.pageSize`.
 */
export function buildSystemQueryString({
  system,
  systemQuery,
  pagination,
  sortParam,
  globalFilter,
  cursor,
}: SystemQueryInput): string {
  const params = new URLSearchParams()
  // Static query params merged into every request (e.g. { status: 'failed' }).
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  // Dynamic params from an external filter bar override the static ones. Empty
  // values clear the param (e.g. the automation filter back to "Toutes").
  Object.entries(systemQuery ?? {}).forEach(([key, value]) => {
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- URLSearchParams.delete, not a Drizzle query builder
    if (value === '') params.delete(key)
    else params.set(key, value)
  })
  // Read-side params (endpoint-side / forwarded): position, sort, search.
  if (cursor === undefined) params.set('page', String(pagination.pageIndex + 1))
  else params.set('cursor', cursor)
  if (pagination.pageSize && !params.has('limit')) {
    params.set('limit', String(pagination.pageSize))
  }
  if (sortParam) params.set('sort', sortParam)
  if (globalFilter) params.set('q', globalFilter)
  return params.toString()
}

/**
 * Read a response's `appliedQuery` declaration BY KEY PRESENCE, as the
 * `{ appliedQuery }` spread a `FetchResult` takes.
 *
 * Shared by BOTH fetch paths — the system endpoints here and the DB-table
 * records API (`use-data-table-query.ts`) — because the distinction is exactly
 * one character wide and both paths feed the same `serverFiltered` decision.
 * `'appliedQuery' in json` keeps three states; `json.appliedQuery ?? undefined`
 * keeps two, collapsing `null` ("searches server-side, no term supplied") into
 * "does not search" and silently re-enabling the in-memory filter the moment an
 * operator CLEARS the box — the double filter, back, on the one interaction
 * nobody re-tests.
 *
 * Returns `{}` — not `{ appliedQuery: undefined }` — so the key stays genuinely
 * absent from the result: the consumer reads presence too.
 */
export function readAppliedQuery(json: { readonly appliedQuery?: unknown }): {
  readonly appliedQuery?: string | null
} {
  const value = 'appliedQuery' in json ? json.appliedQuery : undefined
  return typeof value === 'string' || value === null ? { appliedQuery: value } : {}
}

/**
 * Read a response's continuation token, as the `{ nextCursor }` spread a
 * {@link FetchResult} takes.
 *
 * Unlike {@link readAppliedQuery} this reads by VALUE, not by key presence, and
 * the two are different on purpose. `appliedQuery` is tri-state because `null`
 * carries information ("this endpoint searches, and no term was supplied").
 * `nextCursor` is binary: the cursor endpoints all ship the key on every
 * response and set it to `null` at the end of the feed, so an absent key and a
 * `null` value mean the same thing — there is nothing more to ask for. Both
 * therefore collapse to "no continuation", and an EMPTY string does too, since
 * a blank token would build `?cursor=` and ask the server to resume from
 * nowhere.
 *
 * Returns `{}` rather than `{ nextCursor: undefined }` so the key stays absent
 * from the result: the consumer decides whether to offer "load more" on
 * presence.
 */
export function readNextCursor(json: { readonly nextCursor?: unknown }): {
  readonly nextCursor?: string
} {
  const value = json.nextCursor
  return typeof value === 'string' && value.length > 0 ? { nextCursor: value } : {}
}

/** How much of a failed response body reaches the operator's error alert. */
const ERROR_BODY_MAX_CHARS = 300

/**
 * Read a failed response's body for display, BOUNDED.
 *
 * The thrown message is rendered verbatim in the grid's error alert, so an
 * unbounded `res.text()` puts the whole response there. That is fine for the
 * JSON error envelopes these endpoints normally return, and wrong for the case
 * that actually occurs when something upstream breaks: a 500 or a proxy fault
 * answers with an HTML error PAGE, and the operator gets kilobytes of markup
 * instead of a diagnosis. The status code — already interpolated ahead of this
 * — is the actionable half; the body is context.
 *
 * A body that cannot be read at all must not mask the real failure with a
 * secondary one, so the read is guarded and degrades to an empty string.
 */
async function readErrorBody(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  const collapsed = body.replaceAll(/\s+/gu, ' ').trim()
  return collapsed.length > ERROR_BODY_MAX_CHARS
    ? `${collapsed.slice(0, ERROR_BODY_MAX_CHARS)}…`
    : collapsed
}

/**
 * Parse a system-endpoint response envelope into `{ records, total }`: rows are
 * read at `rowsKey`, each row's id normalized onto the canonical `id` key,
 * run-status localized for a named runs grid, and `total` taken from `totalKey`
 * when numeric (else rows length).
 */
export function parseSystemEnvelope(
  system: SystemSource,
  sourceId: string | undefined,
  json: Record<string, unknown>
): FetchResult {
  const rowsKey = system.rowsKey ?? 'items'
  const idKey = system.idKey ?? 'id'
  const rawRows = Array.isArray(json[rowsKey]) ? (json[rowsKey] as readonly TableRecord[]) : []
  // Normalize each row's id onto the canonical `id` key so row identity +
  // row-click actions resolve uniformly.
  const idMapped: readonly TableRecord[] = rawRows.map((row) =>
    idKey === 'id' ? row : { ...row, id: row[idKey] }
  )
  const records = localizeRunStatusRows(system.endpoint, sourceId, idMapped)
  const totalRaw = system.totalKey ? json[system.totalKey] : undefined
  const total = typeof totalRaw === 'number' ? totalRaw : records.length
  // PRESENCE, not truthiness — see `readAppliedQuery`, which both fetch paths
  // share so the three-state read cannot be spelled two ways.
  return { records, total, ...readAppliedQuery(json), ...readNextCursor(json) }
}

/**
 * Fetch one page of rows from a system read endpoint and normalize the
 * `{ [rowsKey]: [...] }` envelope to the consumer's `{ records, total }` shape.
 * Sends the session cookie so admin read endpoints authorize the request.
 */
export async function fetchSystemEndpoint({
  system,
  systemQuery,
  sourceId,
  pagination,
  sortParam,
  globalFilter,
  cursor,
}: SystemFetchQuery): Promise<FetchResult> {
  const suffix = buildSystemQueryString({
    system,
    systemQuery,
    pagination,
    sortParam,
    globalFilter,
    ...(cursor !== undefined && { cursor }),
  })
  const url = `${system.endpoint}${suffix ? `?${suffix}` : ''}`
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    // The MESSAGE is what an operator reads in the grid's alert, so it carries the
    // status and nothing else. The raw envelope goes in `cause`, where a developer
    // can still reach it from the console — it used to be concatenated into the
    // message, which put a JSON blob on screen under a doubled 'Failed to…' prefix.
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`The server refused this request (${res.status}).`, {
      cause: await readErrorBody(res),
    })
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemEnvelope(system, sourceId, json)
}

// ---------------------------------------------------------------------------
// Single-record DETAIL fetch (CAP-2)
// ---------------------------------------------------------------------------

/**
 * The single-record counterpart to the rows-envelope fetch above. Where the
 * rows fetch extracts an ARRAY at `rowsKey`, the detail fetch injects a bound
 * record id into the endpoint's `:param` placeholder and extracts exactly ONE
 * record at `recordKey` (or the whole body when `recordKey` is omitted). It
 * reuses the SAME credentialed `fetch` discipline so admin detail endpoints
 * authorize the request. Mirrors `SystemDetailSourceSchema`.
 */

/**
 * Build the detail-endpoint URL: substitute `id` into the endpoint's `:param`
 * placeholder (default `:id`) and append any static `system.query` params.
 */
export function buildDetailEndpointUrl(system: SystemDetailSource, id: string): string {
  const placeholder = `:${system.param ?? 'id'}`
  const path = system.endpoint.includes(placeholder)
    ? system.endpoint.replace(placeholder, encodeURIComponent(id))
    : system.endpoint
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  const suffix = params.toString()
  return `${path}${suffix ? `?${suffix}` : ''}`
}

/**
 * Parse a detail-endpoint response into a single record: read it at `recordKey`
 * (fallback the whole body), then normalize its id onto the canonical `id` key
 * from `idKey` (default `'id'`) so downstream field lookups resolve uniformly.
 */
export function parseSystemDetailEnvelope(
  system: SystemDetailSource,
  json: Record<string, unknown>
): TableRecord {
  const raw = system.recordKey !== undefined ? json[system.recordKey] : json
  const record = (typeof raw === 'object' && raw !== null ? raw : {}) as TableRecord
  const idKey = system.idKey ?? 'id'
  return idKey === 'id' ? record : { ...record, id: record[idKey] }
}

/**
 * Fetch ONE record from a system detail endpoint (the bound id injected into the
 * `:param` slot) and normalize it to a single record. Sends the session cookie
 * so admin detail endpoints authorize the request.
 */
export async function fetchSystemDetailEndpoint(
  system: SystemDetailSource,
  id: string
): Promise<TableRecord> {
  const url = buildDetailEndpointUrl(system, id)
  const res = await fetch(url, { credentials: 'include' })

  if (!res.ok) {
    // eslint-disable-next-line functional/no-throw-statements -- TanStack Query expects thrown errors
    throw new Error(`Failed to fetch system record: ${res.status} ${await readErrorBody(res)}`)
  }

  const json = (await res.json()) as Record<string, unknown>
  return parseSystemDetailEnvelope(system, json)
}
