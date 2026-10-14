/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  authMiddleware,
  requireAdminTier,
  type ContextWithSession,
} from '@/presentation/api/middleware/auth'
import { notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { SessionHono } from '@/presentation/api/middleware/admin-route-guards'

/**
 * The gate of the two MCP client reads, `GET /api/ai/mcp/client/status` and
 * `GET /api/ai/mcp/client/tools`.
 *
 * They name the operator's external servers, their addresses and their tools,
 * so they are admin reads: `requireAdminTier` answers a caller with no session
 * and a caller below the admin tier the anti-enumeration 404, the same answer
 * an unknown route gives (S1). Without `app.auth` there is no session at all,
 * so nobody reads them — the posture of the console's own admin reads
 * (`chainAdminRouteGuardsWithoutAuth`).
 *
 * The refusal is the body an unknown `/api/*` route answers, byte for byte, not
 * the admin guard's own 404: these routes live outside `/api/admin/*`, and a
 * different body beside them would tell a prober the route exists.
 *
 * The two paths are named exactly rather than through `/api/ai/mcp/client/*`,
 * so an unknown path beside them keeps the router's own 404.
 */
const MCP_CLIENT_READS = ['/api/ai/mcp/client/status', '/api/ai/mcp/client/tools'] as const

/** `requireAdminTier`, refusing with the unknown-route 404 instead of the admin one. */
const requireAdminAsUnknownRoute = (resolveAppForTier: () => App) => {
  const gate = requireAdminTier(resolveAppForTier)
  return async (c: ContextWithSession, next: () => Promise<void>): Promise<Response | void> => {
    const admitted = { value: false }
    const refusal = await gate(c, async () => {
      admitted.value = true
      await next()
    })
    if (admitted.value) return refusal
    return c.json(notFoundBody(), 404)
  }
}

export const chainMcpClientRouteGuards = (
  honoApp: SessionHono,
  auth: Readonly<ReturnType<typeof createAuthInstance>> | undefined,
  resolveAppForTier: () => App
): SessionHono =>
  MCP_CLIENT_READS.reduce<SessionHono>(
    (acc, path) =>
      (auth === undefined ? acc : acc.use(path, authMiddleware(auth))).use(
        path,
        requireAdminAsUnknownRoute(resolveAppForTier)
      ) as SessionHono,
    honoApp
  )
