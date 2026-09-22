/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/decisions` — the architecture decision records an app
 * declares beside the configuration they decided.
 *
 * Authorised by [internal ref] **amendment A6**, on A1's invariant: reading the
 * running configuration is observability, mutating it is authoring. This module
 * has one GET handler and no request schema because there is nothing a caller
 * can send.
 *
 * ─── THE GUARD IS UPSTREAM, AND IT NEEDS THE SEGMENT-LESS PATH ─────────────
 *
 * Anti-enumeration 404 (S1) is wired by `requireAdminTier()` in
 * `presentation/api/middleware/admin-route-guards.ts`, in BOTH the
 * auth-enabled and the no-`app.auth` mirror. The entry there is on the exact
 * path `/api/admin/decisions` and not on a `/*` wildcard: Hono requires at
 * least one segment to match `/*`, so a wildcard-only guard would leave this
 * URL — the only one this module serves — open to anonymous callers.
 *
 * A 403 is never the answer. An authenticated non-admin receiving one learns
 * the endpoint exists, which is the enumeration the rule denies.
 */

import { readDecisionRegister } from '@/application/use-cases/admin/decisions-register'
import { decisionsCatalogResponseSchema } from '@/domain/models/api/admin/decisions/catalog'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * `GET /api/admin/decisions` — every declared record, in declared order, with
 * four flat counts.
 *
 * An app declaring no register answers 200 with an empty list and four zeroes,
 * never 404: an operator who declared no decisions is not an error case, and a
 * 404-when-absent is indistinguishable from a route that was never mounted.
 */
export async function handleGetDecisions(c: Context, app: App): Promise<Response> {
  const body = await runDomainPromise(c, readDecisionRegister(app))

  const parsed = decodeSafe(decisionsCatalogResponseSchema)(body)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build decisions response', code: 'INTERNAL_ERROR' },
      500
    )
  }

  // The register is a function of the running config, so a shared cache holding
  // it would answer "what was decided?" with what a previous deploy declared —
  // the same reason the two config-introspection reads next door are no-store.
  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

/**
 * Chain the decisions read onto a Hono instance.
 *
 * `resolveApp` is the LIVE-App resolver rather than the boot-time `app`, so a
 * config reload is reflected without a restart — the endpoint's whole promise
 * is that it shows the decisions behind what is running now.
 */
export function chainAdminDecisionsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp.get('/api/admin/decisions', (c) => handleGetDecisions(c, resolveApp())) as T
}
