/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/organisation/graph` — the one read behind the console's
 * Organisation page.
 *
 * A thin handler over {@link buildAdminOrganisationGraph}: resolve the live
 * app, run the program on the request's domain services, validate the body, and
 * serialise. Everything that could fail has already been rescued inside the use
 * case, so there is no error path here beyond the response gate.
 *
 * ─── WHY `resolveLiveApp` AND NOT THE BOOT `app` ────────────────────────────
 *
 * `tables`, `pages` and `buckets` sit OUTSIDE the restart set
 * (`classify-config-change.ts`), so they hot-swap under `--watch` and after a
 * draft publish. This page's entire job is to explain the configuration the
 * server is actually running; a graph drawn from the boot config would describe
 * the previous deploy's permissions, which is worse than no graph.
 *
 * ─── AUTH ───────────────────────────────────────────────────────────────────
 *
 * Gating is wired upstream in `admin-route-guards.ts`, in BOTH mirrors, as an
 * explicit `/api/admin/organisation/*` pair rather than by inheritance from the
 * defense-in-depth catch-all. `requireAdminTier` answers **404** for a missing
 * session AND for a non-admin-tier caller (S1 anti-enumeration): a 401 or 403
 * would confirm to whoever probes that this instance publishes a map of who can
 * reach what.
 *
 * @see src/application/use-cases/admin/organisation-graph.ts (the graph fold)
 * @see src/domain/models/api/admin/organisation/graph.ts (the wire contract)
 */

import { buildAdminOrganisationGraph } from '@/application/use-cases/admin/organisation-graph'
import {
  adminOrganisationGraphQuerySchema,
  adminOrganisationGraphResponseSchema,
} from '@/domain/models/api/admin/organisation/graph'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { effectValidator } from '@/presentation/api/runtime/effect-validator'
import type { AdminOrganisationGraphQuery } from '@/domain/models/api/admin/organisation/graph'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Read what the paired `effectValidator('query', …)` decoded.
 *
 * The handler takes a bare `Context` so it stays callable from a test and from
 * the chain alike — the shape every sibling admin handler has — and `c.req.valid`
 * is typed only off the fluent chain, so the cast names exactly what the
 * validator put there.
 */
const validQuery = (c: Context): AdminOrganisationGraphQuery =>
  (c.req as unknown as { readonly valid: (target: 'query') => AdminOrganisationGraphQuery }).valid(
    'query'
  )

/**
 * Build the handler for `GET /api/admin/organisation/graph`.
 *
 * The factory closes over the live-app resolver rather than an `App` value, so
 * every request folds the configuration the server is running at that moment.
 */
function createHandleGetOrganisationGraph(resolveLiveApp: () => App) {
  return async function handleGetOrganisationGraph(c: Context): Promise<Response> {
    const graph = await runRequestEffect(
      c,
      provideDomain(c, buildAdminOrganisationGraph(resolveLiveApp(), validQuery(c)))
    )

    // Response gate (S4 hard allow-list): the body is an allow-list of scalars,
    // closed enums and short rendered strings — never a raw DB row, an account
    // address or a field value. Every struct is `strictKeys`, so a producer that
    // starts spreading a directory row into a `person` node fails HERE rather
    // than publishing an email.
    const parsed = decodeSafe(adminOrganisationGraphResponseSchema)(graph)
    if (!parsed.success) {
      logError(
        '[admin] organisation graph response validation failed',
        parsed.error,
        requestLogAttributes(c)
      )
      return c.json(
        { success: false, message: 'Failed to build organisation graph', code: 'INTERNAL_ERROR' },
        500
      )
    }

    // The whole body is derived per request — the findings are recomputed, the
    // principal population is read live — so a shared cache would serve one
    // operator another operator's moment.
    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data, 200)
  }
}

/**
 * Chain the organisation read onto a Hono app.
 *
 * Provides:
 * - GET /api/admin/organisation/graph — the resolved access graph
 *   (`principals -> grant sources -> resources`), the process lanes, the
 *   findings derived from them, the declared narrowings a Matrix cell cannot
 *   show, and the names of any source that could not be read. Takes one
 *   optional `?node=<id>` narrowing the graph to one subject.
 *
 * Read-only: no other method is served, nothing is written, and no
 * finding is stored. Auth gating (admin tier, anti-enumeration 404) is wired
 * upstream in `admin-route-guards.ts`.
 *
 * ─── THE VALIDATOR RUNS AFTER THE GUARD, AND THAT ORDER IS THE CONTRACT ─────
 *
 * `chainAdminRouteGuards` mounts `authMiddleware` + `requireAdminTier` on
 * `/api/admin/organisation/*` before any route is chained, so Hono dispatches
 * them ahead of this route-level validator. That is what makes a MALFORMED
 * `?node=` answer 404 rather than 400 to a caller without the tier: a 400 would
 * confirm both that the route exists and that it takes this parameter, which is
 * an enumeration oracle no test of the bare path could catch (S1). The admin
 * still receives a real 400 for the same request.
 *
 * @param honoApp - Hono instance to chain the route onto
 * @param resolveLiveApp - Resolver for the config the server is currently running
 * @returns Hono app with the organisation route chained
 */
export function chainAdminOrganisationRoutes<T extends Hono>(
  honoApp: T,
  resolveLiveApp: () => App
): T {
  return honoApp.get(
    '/api/admin/organisation/graph',
    effectValidator('query', adminOrganisationGraphQuerySchema),
    createHandleGetOrganisationGraph(resolveLiveApp)
  ) as T
}
