/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { subscribe } from './event-bus'

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
 * it settles, so a later read — a poll, a page turn — asks the server again.
 * A re-read after a WRITE must not join a request either: one still in flight
 * when the write lands was answered from the rows before it, and joining it
 * hands the re-read that old answer — the uploaded file missing from the grid
 * that was told to show it. So a sibling's `sovrium:refetch` (fired after its
 * write succeeded) forgets every read in flight, and so does a grid's own
 * refresh ({@link forgetReadsInFlight}). Each caller receives its own `Response`,
 * rebuilt from the one body, so each can read it once as a `fetch` response
 * would allow.
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
 * The address a read is shared under: its path and its query parameters in
 * sorted order, so two components asking for the same query with their
 * parameters written in a different order share one request.
 */
export const coalescingKey = (url: string): string => {
  const at = url.indexOf('?')
  if (at < 0) return url
  const sorted = [...new URLSearchParams(url.slice(at + 1))].toSorted(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  )
  return `${url.slice(0, at)}?${new URLSearchParams(sorted).toString()}`
}

/**
 * `fetch(url, { credentials: 'include' })`, sharing the request with any
 * identical one already in flight — identical up to the order of its query
 * parameters; the first caller's address is the one fetched. A network failure
 * rejects every caller that shared the request, as it would have rejected each
 * of their own.
 */
export function fetchCoalesced(url: string): Promise<Response> {
  const key = coalescingKey(url)
  const shared = inFlight.get(key)
  if (shared !== undefined) return shared.then(toResponse)
  const pending: Promise<CapturedResponse> = capture(url).finally(() => {
    // Only this request's own entry: a re-read started after it was forgotten
    // may hold the key by now, and it is still in flight.
    if (inFlight.get(key) === pending) inFlight.delete(key)
  })
  inFlight.set(key, pending)
  return pending.then(toResponse)
}

/**
 * Stop sharing every request now in flight: each caller already waiting keeps
 * its answer, and the next read of any address asks the server again. Called
 * before a re-read that a write asked for, whose answer must postdate it.
 */
export function forgetReadsInFlight(): void {
  inFlight.clear()
}

// Registered when the first reader loads, so it runs before any component's own
// `sovrium:refetch` listener and the re-read that listener starts asks afresh.
subscribe('sovrium:refetch', forgetReadsInFlight)
