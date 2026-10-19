/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table's calendar feed over HTTP (`tables[].calendarFeed`).
 *
 *   POST   /api/tables/:table/calendar-feed/token     mint or replace — 201 `{ url, createdAt }`
 *   GET    /api/tables/:table/calendar-feed/token     status          — 200 `{ active, createdAt? }`
 *   DELETE /api/tables/:table/calendar-feed/token     revoke          — 204, or 404 when none
 *   GET    /api/tables/:table/calendar-feed/:token.ics               — the feed, with no session
 *
 * The three token routes ride the table chain like any records route: a
 * session or 401, and 404 for a table that does not exist, that the caller may
 * not read, or that declares no feed (S1). The feed address is read by a
 * calendar app that sends no cookie, so it is registered AHEAD of that chain
 * and its token is its only credential: every way it may not be read is the
 * same 404 body. It stays behind the per-address limiter on `/api/tables/*`.
 *
 * The token appears in no log line, span or audit entry: the access log and
 * the error log redact the path (`redactSecretPath`), and every trace names the
 * route TEMPLATE, `/api/tables/:table/calendar-feed/:token.ics`.
 */

import { Effect } from 'effect'
import {
  calendarFeedPath,
  mayHoldCalendarFeed,
  mintCalendarFeedToken,
  readCalendarFeed,
  readCalendarFeedToken,
  revokeCalendarFeedToken,
} from '@/application/use-cases/tables/calendar-feed'
import { resolveRequestBaseUrl } from '@/domain/kernel/url/request-base-url'
import {
  calendarFeedTokenMintedSchema,
  calendarFeedTokenStatusSchema,
} from '@/domain/models/api/tables/calendar-feed'
import { logError } from '@/infrastructure/logging/logger'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import {
  respondWith,
  runHandlerEffect,
  toErrorResponse,
} from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context, Hono, Next } from 'hono'

/** The feed address, as registered — the template every trace and log names. */
export const CALENDAR_FEED_ROUTE = '/api/tables/:table/calendar-feed/:token.ics'

/** The token routes. */
const TOKEN_ROUTE = '/api/tables/:tableId/calendar-feed/token'

/** The headers a feed is served with: not cached, not indexed, no referrer. */
const FEED_HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
} as const

/** The caller of a token route and the table she named, behind the table chain. */
const tokenCaller = (c: Context) => {
  const { session, tableName } = getTableContext(c)
  return { userId: session.userId, tableName }
}

/** Run `respond` only when the caller may hold an address for the table; else 404. */
const whenCallerMayHold = (
  c: Context,
  app: App,
  respond: (caller: {
    readonly userId: string
    readonly tableName: string
  }) => Effect.Effect<Response, never, DomainServices>
): Promise<Response> => {
  const caller = tokenCaller(c)
  return runHandlerEffect(
    c,
    mayHoldCalendarFeed(app, caller.userId, caller.tableName).pipe(
      Effect.flatMap((may) => (may ? respond(caller) : Effect.succeed(notFound(c))))
    )
  )
}

const handleMint = (c: Context, app: App): Promise<Response> =>
  whenCallerMayHold(c, app, ({ userId, tableName }) =>
    respondWith(
      c,
      mintCalendarFeedToken(userId, tableName).pipe(
        Effect.map(({ token, createdAt }) => ({
          // The address a calendar app outside can reach: `BASE_URL`, else what a
          // declared proxy forwarded — never the internal `http://` origin the
          // server sees behind a TLS proxy.
          url: `${resolveRequestBaseUrl(c)}${calendarFeedPath(tableName, token)}`,
          createdAt: createdAt.toISOString(),
        }))
      ),
      calendarFeedTokenMintedSchema,
      201
    )
  )

const handleStatus = (c: Context, app: App): Promise<Response> =>
  whenCallerMayHold(c, app, ({ userId, tableName }) =>
    respondWith(
      c,
      readCalendarFeedToken(userId, tableName).pipe(
        Effect.map((address) =>
          address === undefined
            ? { active: false }
            : { active: true, createdAt: address.createdAt.toISOString() }
        )
      ),
      calendarFeedTokenStatusSchema
    )
  )

const handleRevoke = (c: Context, app: App): Promise<Response> =>
  whenCallerMayHold(c, app, ({ userId, tableName }) =>
    Effect.match(revokeCalendarFeedToken(userId, tableName), {
      onFailure: (failure) => toErrorResponse(c, failure),
      onSuccess: (revoked) => (revoked ? c.body(null, 204) : notFound(c)),
    })
  )

/**
 * `GET …/calendar-feed/:token.ics`, read with no session. A last segment that
 * does not end in `.ics` is another route's (`…/calendar-feed/token`), so it is
 * handed on.
 */
const handleFeed = async (c: Context, next: Next, app: App): Promise<Response | undefined> => {
  const file = c.req.param('token.ics') ?? ''
  if (!file.endsWith('.ics')) {
    await next()
    return undefined
  }
  return runHandlerEffect(
    c,
    readCalendarFeed({
      app,
      tableName: c.req.param('table') ?? '',
      token: file.slice(0, -'.ics'.length),
      // The host every event UID names: the public one, so a UID stays the same
      // whichever proxy hop or internal address a poll arrived through.
      host: new URL(resolveRequestBaseUrl(c)).hostname,
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[calendar-feed] the feed could not be read', cause))
      ),
      Effect.match({
        // effect-swallow: a store that cannot be read answers as an unknown
        // address — the feed says nothing about why, to anyone holding any
        // token. The cause is logged on the way past (E6).
        onFailure: () => notFound(c),
        onSuccess: (body) =>
          body === undefined ? notFound(c) : c.body(body, 200, { ...FEED_HEADERS }),
      })
    )
  )
}

/**
 * Register the feed address. Called AHEAD of the table middleware chain, so a
 * calendar app's cookie-less request never meets `validateTable`, the role
 * lookup or the read gate — the token is checked inside.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono type inference with middleware requires flexible typing
export function chainCalendarFeedReadRoute<T extends Hono<any, any, any>>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp.get(CALENDAR_FEED_ROUTE, (c, next) => handleFeed(c, next, resolveApp())) as T
}

/** Register the three token routes, behind the table middleware chain. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono type inference with middleware requires flexible typing
export function chainCalendarFeedTokenRoutes<T extends Hono<any, any, any>>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp
    .post(TOKEN_ROUTE, (c) => handleMint(c, resolveApp()))
    .get(TOKEN_ROUTE, (c) => handleStatus(c, resolveApp()))
    .delete(TOKEN_ROUTE, (c) => handleRevoke(c, resolveApp())) as T
}
