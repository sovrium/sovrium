/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The renderer's server-side rows reader, shared by the TWO render funnels.
 *
 * ─── WHY IT IS ITS OWN MODULE ──────────────────────────────────────────────
 *
 * It was born inside `renderWithCache` because that is the one funnel every
 * OPERATOR page passes through, and the comment there argued — correctly — that
 * attaching it per route would mean the same three lines at four construction
 * sites, "each free to forget the cookie".
 *
 * A mounted app is the second funnel. `mounted-app-routes.ts` calls
 * `config.renderPage` directly, so it never passed through `renderWithCache`
 * and never received a fetcher: every `redirectToFirst` on a console page
 * silently resolved to "no first row" and rendered the bare collection instead
 * of redirecting. That failure is invisible — it looks exactly like an empty
 * collection, which is the state the resolver is designed to degrade to — so it
 * would not have shown up as an error anywhere.
 *
 * Copying the function into the mount was the alternative, and it is the one
 * the original comment names as the thing to avoid: two copies of the borrowed
 * -header list is one copy that can drift, and a drifted list authenticates as
 * nobody while looking like it works.
 *
 * @see src/presentation/rendering/first-object-redirect-resolver.ts — the consumer
 */

import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import type { Context } from 'hono'

/**
 * Deadline for the two loopback reads below.
 *
 * These are the only egress calls in the render path, and they address THIS
 * server: a slow answer means the runtime is already saturated, so waiting
 * longer holds a render worker open and makes the saturation worse. Eight
 * seconds is generous for a local API read and still well inside any sane
 * reverse-proxy budget, and the timeout degrades to the same "no rows" both
 * readers already return for a non-2xx answer.
 */
const LOOPBACK_READ_TIMEOUT_MS = 8000

/**
 * Build the renderer's server-side rows reader for this request.
 *
 * `page.redirectToFirst` must know the FIRST row of a page's list before
 * deciding whether to render the page at all, and that list is often a system
 * READ ENDPOINT rather than a table — so the only faithful read is a request to
 * our own API. Two properties make that safe rather than clever:
 *
 *  - the caller's IDENTITY headers are forwarded, so the rows are exactly the
 *    rows that visitor could have seen. A redirect computed from rows they
 *    cannot read would disclose the first object's existence;
 *  - the target is an API route, never a page, so this cannot recurse into
 *    rendering.
 *
 * It fires only for a page declaring `redirectToFirst` (or a system option
 * source); every other page never calls it. Any failure resolves to no rows,
 * which the resolver treats as an empty collection — the page renders.
 */
export function systemRowsFetcher(
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): (endpoint: string, rowsKey: string) => Promise<readonly Record<string, unknown>[]> {
  return async (endpoint, rowsKey) => {
    const response = await withFetchTimeout(
      new URL(endpoint, c.req.url),
      { headers: borrowedIdentityHeaders(c) },
      LOOPBACK_READ_TIMEOUT_MS
    ).catch(() => undefined)
    if (response === undefined || !response.ok) return []
    const body = (await response.json()) as Record<string, unknown>
    const rows = body[rowsKey]
    return Array.isArray(rows) ? (rows as readonly Record<string, unknown>[]) : []
  }
}

/**
 * Build the renderer's server-side SINGLE-RECORD reader for this request.
 *
 * The sibling of `systemRowsFetcher`, and deliberately in the same file: both
 * borrow the same identity, and the whole argument for that function having its
 * own module is that a second copy of the borrowed-header list is a copy that
 * can drift — and a drifted list authenticates as nobody while looking like it
 * works.
 *
 * A page bound to `dataSource: { system }` is NAMED by its record — the console
 * link deep-dive prints the OPERATOR's `links.title` — and before [internal ref]
 * that record was fetched by an island after the document had already shipped.
 * So the heading was the literal `$record.title` for a crawler, and stayed that
 * way forever for a reader with no scripting.
 *
 * `undefined` means "no record for this caller", which the page turns into its
 * own 404. The three cases are deliberately NOT distinguished — refused,
 * absent, and naming nothing all mean the record the page is named after is not
 * there for this caller, and telling them apart would disclose which (S1).
 */
export function systemRecordFetcher(
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): (
  endpoint: string,
  recordKey: string | undefined
) => Promise<Readonly<Record<string, unknown>> | undefined> {
  return async (endpoint, recordKey) => {
    const response = await withFetchTimeout(
      new URL(endpoint, c.req.url),
      { headers: borrowedIdentityHeaders(c) },
      LOOPBACK_READ_TIMEOUT_MS
    ).catch(() => undefined)
    if (response === undefined || !response.ok) return undefined
    const body = (await response.json()) as Record<string, unknown>
    const record = recordKey === undefined ? body : body[recordKey]
    return typeof record === 'object' && record !== null && !Array.isArray(record)
      ? (record as Readonly<Record<string, unknown>>)
      : undefined
  }
}

/**
 * The caller's headers the internal read must reproduce to be authenticated AS
 * the caller.
 *
 * The cookie alone is NOT enough, and the failure is silent rather than loud:
 * `authMiddleware` validates session BINDING (`processSessionResult`), so a
 * request carrying a valid session cookie under a different `User-Agent` — such
 * as the runtime's own `Bun/x.y` — resolves no session and the endpoint answers
 * 401. The redirect then never fires and the page just renders, which looks
 * exactly like an empty collection.
 *
 * The IP headers are here for the same reason: session binding compares the
 * stored address against `getRequestTrustedClientIp`, which reads only these
 * three forwarding headers. Everything else is deliberately NOT forwarded — the
 * point is to borrow an identity, not to replay a request.
 */
const BORROWED_HEADERS = [
  'cookie',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
] as const

function borrowedIdentityHeaders(
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    BORROWED_HEADERS.flatMap((name) => {
      const value = c.req.header(name)
      return value === undefined ? [] : [[name, value] as const]
    })
  )
}
