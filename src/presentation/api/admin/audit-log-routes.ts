/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/audit-log` — the admin audit trail, filtered by `actorId`,
 * `action`, `transport` and/or `resourceType` (exact, conjunctive; an
 * unrecognised value answers an empty page, never a 400).
 *
 * The read is an admin read-registry entry
 * (`application/use-cases/admin/people-read-operations.ts`), mounted here
 * through `chainAdminReadRoutes`: the route, its OpenAPI operation and its MCP
 * admin tool are one entry. It writes no audit event — reading the trail must
 * not grow it. Auth gating is upstream (`requireAdminTier()`).
 */

import { AUDIT_LOG_READ_OPERATIONS } from '@/application/use-cases/admin/admin-read-registry'
import { chainAdminReadRoutes } from '@/presentation/api/admin/read-operation-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/** Chain `GET /api/admin/audit-log` onto a Hono app. */
export const chainAdminAuditLogRoutes = <T extends Hono>(honoApp: T, resolveApp: () => App): T =>
  chainAdminReadRoutes(honoApp, resolveApp, AUDIT_LOG_READ_OPERATIONS)
