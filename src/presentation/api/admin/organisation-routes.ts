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

import { ORGANISATION_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Chain the organisation read onto a Hono app.
 *
 * `GET /api/admin/organisation/graph` is an admin read-registry entry
 * (`application/use-cases/admin/people-read-operations.ts`): the route, its
 * OpenAPI operation and its MCP admin tool are one entry. Read-only:
 * nothing is written and no finding is stored.
 *
 * The admin-tier guard on `/api/admin/organisation/*` is mounted before any
 * route, so a MALFORMED `?node=` answers 404 — never a 400 that would confirm
 * the route — to a caller without the tier; the admin still gets the 400.
 */
export function chainAdminOrganisationRoutes<T extends Hono>(
  honoApp: T,
  resolveLiveApp: () => App
): T {
  return chainAdminReadRoutes(honoApp, resolveLiveApp, ORGANISATION_READ_OPERATIONS)
}
