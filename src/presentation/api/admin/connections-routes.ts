/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin read endpoints for the **App Connections** family (the connection
 * browser + per-user token roster that backs `/_admin/data/connections`):
 *
 *   - GET /api/admin/connections      — the connection list, one row per
 *     `system.connections` row with its per-connection token/expiry summary +
 *     derived `status` badge.
 *   - GET /api/admin/connections/:id  — detail: the connection header + the
 *     per-user token roster (secret-free: `userId` + `expiresAt` + per-user
 *     `status`).
 *
 * Both are admin read-registry entries
 * (`application/use-cases/admin/links-connections-read-operations.ts`), mounted
 * here through `chainAdminReadRoutes`: the route, its OpenAPI operation and its
 * MCP admin tool are one entry.
 *
 * Both read the RUNTIME DB rows in `system.connections` joined with the
 * per-connection token summary from `system.connection_tokens` (NOT the
 * `app.connections` config). Both emit exactly ONE
 * `connection.{list|detail}.queried` audit entry on success, with the canonical
 * `resource.type === 'connection'` (derived by the emit use-case from the action
 * catalog).
 *
 * Auth gating is wired upstream by `authMiddleware` + `requireAdminTier()` on
 * BOTH the `/api/admin/connections/*` wildcard AND the bare
 * `/api/admin/connections` path in `infrastructure/server/route-setup/
 * api-routes.ts`, which 404s both missing-session and wrong-role callers (S1
 * anti-enumeration). The entries add only the per-connection anti-enum 404 (an
 * unknown connection id is not an enumerable resource) and the success path.
 *
 * ⛔ SECURITY (S4 — absolute): the response is a HARD ALLOW-LIST. The use case
 * projects ONLY the allow-listed fields and validates against the strict
 * schema, so `credentials` / `accessToken` / `refreshToken` can NEVER be
 * serialized — on HTTP or over MCP.
 */

import { CONNECTIONS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Chain the admin/connections read routes onto a Hono app.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAdminTier on the `/api/admin/connections/*` wildcard AND the bare
 * `/api/admin/connections` path). Connection rows are read from the RUNTIME DB,
 * not `app.connections` config; the resolver only satisfies the registry's
 * adapter. The single-segment `/:id` does not overlap the two-segment action
 * paths chained after it.
 */
export function chainAdminConnectionsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminReadRoutes(honoApp, resolveApp, CONNECTIONS_READ_OPERATIONS)
}
