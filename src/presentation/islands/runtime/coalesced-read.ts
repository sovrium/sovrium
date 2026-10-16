/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One request for every identical credentialed GET in flight at the same time.
 *
 * Several grids can read ONE system envelope and keep different arrays of it —
 * the analytics console's device, browser and OS breakdowns all read
 * `/api/analytics/devices` and keep `deviceTypes`, `browsers` and
 * `operatingSystems`. Each grid caches its own answer (its rows, its total,
 * its summary), so their cache keys rightly differ; what must not differ is
 * the request: without sharing it, the same envelope would be fetched once per
 * grid on the same page load.
 *
 * Only a request ALREADY IN FLIGHT is shared: the entry is dropped the moment
 * it settles, so a later read — a poll, a refetch after a write, a page turn —
 * always asks the server again. Nothing here can serve a stale answer. Each
 * caller receives its own `Response`, rebuilt from the one body, so each can
 * read it once as a `fetch` response would allow.
 */

/** The parts of a response a caller can read, captured once for every caller. */
interface CapturedResponse {
  readonly status: number
  readonly statusText: string
  readonly headers: readonly (readonly [string, string])[]
  readonly body: string
}

/** Statuses whose response may not carry a body (`new Response` refuses one). */
const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([101, 103, 204, 205, 304])

const inFlight = new Map<string, Promise<CapturedResponse>>()

const capture = async (url: string): Promise<CapturedResponse> => {
  const res = await fetch(url, { credentials: 'include' })
  return {
    status: res.status,
    statusText: res.statusText,
    headers: [...res.headers.entries()],
    body: await res.text(),
  }
}

const toResponse = (captured: CapturedResponse): Response =>
  new Response(NULL_BODY_STATUSES.has(captured.status) ? null : captured.body, {
    status: captured.status,
    statusText: captured.statusText,
    headers: captured.headers as [string, string][],
  })

/**
 * `fetch(url, { credentials: 'include' })`, sharing the request with any
 * identical one already in flight. A network failure rejects every caller
 * that shared the request, as it would have rejected each of their own.
 */
export function fetchCoalesced(url: string): Promise<Response> {
  const pending =
    inFlight.get(url) ??
    capture(url).finally(() => {
      inFlight.delete(url)
    })
  inFlight.set(url, pending)
  return pending.then(toResponse)
}
