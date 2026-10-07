/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin read endpoints for the **Agents** family (the agent index + the
 * conversation-history viewer that backs `/_admin/agents`):
 *
 *   - GET /api/admin/agents                          — the agent INDEX the
 *     sidebar's Conversations disclosure lazy-loads.
 *   - GET /api/admin/agents/:name/conversations      — cursor-paginated list,
 *     newest-first by `lastActivityAt`, optional `from`/`to` date window.
 *   - GET /api/admin/agents/:name/conversations/:id  — a single conversation's
 *     header + chronologically-ordered message transcript.
 *
 * All three are admin read-registry entries
 * (`application/use-cases/admin/agents-read-operations.ts`), mounted here
 * through `chainAdminReadRoutes`: the route, its OpenAPI operation and its MCP
 * admin tool are one entry. Each emits exactly ONE
 * `agent.{list|conversation.list|conversation.detail}.queried` audit-log entry
 * on success, with the canonical `resource.type === 'agent'`.
 *
 * Auth gating is wired upstream by `requireAdminTier()`, which 404s both
 * missing-session and wrong-role callers (S1 anti-enumeration): the
 * `/api/admin/agents/*` wildcard covers the per-agent paths, and the trailing
 * `/api/admin/*` defence-in-depth guard covers the SEGMENT-LESS index. The
 * entries add only the per-agent anti-enum 404, the cross-agent
 * conversation-ownership 404, and the success path.
 */

import { AGENTS_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Chain the admin/agents read routes onto a Hono app.
 *
 * The live App is resolved per request through `resolveApp`, so a config swap
 * without restart is reflected in agent resolution.
 */
export function chainAdminAgentsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return chainAdminReadRoutes(honoApp, resolveApp, AGENTS_READ_OPERATIONS)
}
