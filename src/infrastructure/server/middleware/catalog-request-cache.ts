/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Hono middleware that opens a fresh per-request catalog memo
 * (`@/infrastructure/database/sql/catalog-request-cache`) around every request,
 * so the read path asks the database catalog a given (table, column) question
 * at most once per request instead of once per transaction that needs it.
 *
 * Mounted in the same chain as `dbQueryCountMiddleware` and for the same
 * reason: the box has to wrap EVERYTHING downstream, since the probes sit deep
 * inside repository transactions with no request context of their own.
 *
 * Unconditional — there is no env toggle. The memo changes no answer, only how
 * many round-trips producing it costs, and its scope makes it staleness-free
 * by construction (see the module comment on the cache for why request scope
 * is the only scope that needs no invalidation).
 */

import { withCatalogRequestCache } from '@/infrastructure/database/sql/catalog-request-cache'
import type { Context, MiddlewareHandler, Next } from 'hono'

/**
 * Open the memo around `next()`. Hoisted out of the factory so the
 * `consistent-function-scoping` lint stays happy — same shape as
 * `db-query-count-header.ts`.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Hono Context type is mutable by library design
function handleCatalogRequestCache(_c: Context, next: Next): Promise<void> {
  return withCatalogRequestCache(() => next())
}

/** Build the per-request catalog-memo middleware. */
export const catalogRequestCacheMiddleware = (): MiddlewareHandler => handleCatalogRequestCache
