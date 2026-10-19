/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/**
 * `GET|HEAD /api/tables/{table}/calendar-feed/{token}.ics`: one segment for each, no
 * more, matched in the letter case the router matches. `path` is the one the
 * router routes on (`c.req.path`), so an encoded slash (`%2F`) stays inside its
 * segment here exactly as it does there, and no path this admits can reach a
 * handler other than the feed route's.
 */
const CALENDAR_FEED_PATH = /^\/api\/tables\/[^/]+\/calendar-feed\/[^/]+\.ics$/

/**
 * The methods a feed address answers: `GET`, and `HEAD`, which a calendar app
 * may send to probe the address before subscribing. The router answers a
 * `HEAD` with the `GET` route's status and headers, and no body.
 */
const FEED_READ_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD'])

/** Whether `method` and `path` name a calendar feed read, and nothing else. */
export const matchesCalendarFeedRead = (method: string, path: string): boolean =>
  FEED_READ_METHODS.has(method) && CALENDAR_FEED_PATH.test(path)

/**
 * Whether the request reads a table's calendar feed address — the one
 * `/api/tables/*` read a calendar app makes with no cookie. It carries its own
 * credential, the token in its last segment, which the feed route checks; this
 * only lets it past the session gate, never past that check.
 */
export const isCalendarFeedRead = (c: Context): boolean =>
  matchesCalendarFeedRead(c.req.method, c.req.path)
