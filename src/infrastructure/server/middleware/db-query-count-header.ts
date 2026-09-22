/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Hono middleware that wraps every request in a fresh per-request DB
 * query-count box (`@/infrastructure/telemetry/db-query-counter`) and — when
 * `SOVRIUM_DB_QUERY_HEADER=on` — attaches an `X-Sovrium-Db-Queries: <n>`
 * response header carrying the number of SQL statements issued while serving
 * the request.
 *
 * Mounted right after `requestId()`/`securityHeaders` in `createHonoApp` so
 * the box wraps EVERYTHING downstream: Better Auth's `/api/auth/*` handler,
 * the `getSession` middleware, the analytics-purge middleware, and every
 * route — the DB work that happens OUTSIDE any Effect program included.
 *
 * ## The ALS wrap is UNCONDITIONAL; only the header EMISSION is gated
 *
 * The `db.query.per_request` histogram observation and the root-span
 * `db.query.count` attribute (see `run-request-effect.ts`) depend on the box
 * existing, and neither is client-visible — so the box opens on every request
 * regardless of the env toggle.
 *
 * ## Why the header defaults OFF (security — do not flip)
 *
 * Always-on, the header lets an unauthenticated caller distinguish "404
 * because the row does not exist" from "404 because you lack permission" by
 * query count — defeating standing rule S1's anti-enumeration guarantee. See
 * `@/domain/models/env/telemetry/db-query-header`.
 *
 * Per-response strategy mirrors `eco-index-header.ts`: the toggle is resolved
 * from `process.env` at REQUEST time (not boot-cached), so operators can flip
 * `SOVRIUM_DB_QUERY_HEADER` and see the next response change without a
 * restart.
 *
 * ## Known, deliberate limitations
 *
 * - A thrown downstream error propagates before the count is snapshotted: the
 *   error response carries no header and records no observation (matching the
 *   eco-index middleware's behavior on throw).
 * - Fire-and-forget work resolving after `next()` returns increments the box
 *   post-snapshot; SSE routes count only the statements issued up to first
 *   byte.
 */

import { parseDbQueryHeader } from '@/domain/models/process-env/telemetry/db-query-header'
import { withDbQueryCount } from '@/infrastructure/telemetry/db-query-counter'
import { recordDbQueriesPerRequest } from '@/infrastructure/telemetry/metrics'
import { emitMetric } from '@/infrastructure/telemetry/observability-runtime'
import type { Context, MiddlewareHandler, Next } from 'hono'

const HEADER_NAME = 'X-Sovrium-Db-Queries'

/**
 * Open the per-request box around `next()`, then record the histogram
 * observation and (when enabled) attach the header. Hoisted out of the
 * middleware factory so the `consistent-function-scoping` lint stays happy.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context type is mutable by library design
async function handleDbQueryCount(c: Context, next: Next): Promise<void> {
  const { count } = await withDbQueryCount(async () => {
    await next()
  })

  // Unconditional: the histogram is server-side observability, not a
  // client-visible surface, so it records regardless of the header toggle.

  emitMetric(recordDbQueriesPerRequest(count))

  const mode = parseDbQueryHeader(process.env as Readonly<Record<string, string | undefined>>)
  if (mode === 'off') return

  c.res.headers.set(HEADER_NAME, String(count))
}

/**
 * Build the DB query-count middleware. Reads `process.env` at REQUEST time so
 * operator changes take effect without a server restart.
 */
export const dbQueryCountMiddleware = (): MiddlewareHandler => handleDbQueryCount
