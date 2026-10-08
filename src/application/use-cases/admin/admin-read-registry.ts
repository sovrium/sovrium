/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin read-operation registry: every `GET /api/admin/*` read that is
 * described once and answered on every surface.
 *
 * Three readers derive from it and none of them names an operation:
 *
 *   - the admin routes mount each entry's `method` + `path`
 *     (`presentation/api/admin/read-operation-routes.ts`),
 *   - the admin OpenAPI fragment publishes each entry's schemas
 *     (`presentation/api/admin/openapi.ts`),
 *   - the MCP server compiles, offers, refuses and dispatches each entry as
 *     `{app}_admin_<suffix>` (`presentation/api/mcp/admin-reads.ts`), and the
 *     console's `GET /api/admin/mcp/tools?category=admin` lists the same names.
 *
 * Adding an admin read is therefore ONE entry in an area's
 * `*-read-operations.ts`, appended to {@link ADMIN_READ_OPERATIONS}. The route,
 * its OpenAPI operation and its MCP tool all follow.
 *
 * {@link enumerateAdminReadOperations} is the pure projection a parity gate
 * reads to diff the registry against the admin GET routes actually mounted.
 */

import { AGENTS_READ_OPERATIONS } from '@/application/use-cases/admin/agents-read-operations'
import { AUTOMATIONS_READ_OPERATIONS } from '@/application/use-cases/admin/automations-read-operations'
import { BUCKETS_READ_OPERATIONS } from '@/application/use-cases/admin/buckets-read-operations'
import { CONFIG_READ_OPERATIONS } from '@/application/use-cases/admin/config-read-operations'
import { CONSOLE_READ_OPERATIONS } from '@/application/use-cases/admin/console-read-operations'
import { DESIGN_SYSTEM_READ_OPERATIONS } from '@/application/use-cases/admin/design-system-read-operations'
import { DESIGN_SYSTEM_SPECIMEN_SHARE_READ_OPERATIONS } from '@/application/use-cases/admin/design-system-specimen-share-read-operations'
import { DEVELOPER_READ_OPERATIONS } from '@/application/use-cases/admin/developer-read-operations'
import { FORMS_READ_OPERATIONS } from '@/application/use-cases/admin/forms-read-operations'
import {
  CONNECTIONS_READ_OPERATIONS,
  LINKS_CONNECTIONS_READ_OPERATIONS,
  LINKS_READ_OPERATIONS,
} from '@/application/use-cases/admin/links-connections-read-operations'
import {
  AUDIT_LOG_READ_OPERATIONS,
  ORGANISATION_READ_OPERATIONS,
  PEOPLE_READ_OPERATIONS,
  USERS_READ_OPERATIONS,
} from '@/application/use-cases/admin/people-read-operations'
import { RELEASE_READ_OPERATIONS } from '@/application/use-cases/admin/release-read-operations'
import { SCHEMA_READ_OPERATIONS } from '@/application/use-cases/admin/schema-read-operations'
import { TEMPLATES_READ_OPERATIONS } from '@/application/use-cases/admin/templates-read-operations'
import { adminReadToolName } from '@/domain/models/app/admin/admin-mcp-read-tools'
import type { AdminReadOperation } from '@/application/use-cases/admin/admin-read-operation'

/** Every admin read operation, in the order MCP `tools/list` offers them. */
export const ADMIN_READ_OPERATIONS: ReadonlyArray<AdminReadOperation> = [
  ...AUTOMATIONS_READ_OPERATIONS,
  ...RELEASE_READ_OPERATIONS,
  ...CONFIG_READ_OPERATIONS,
  ...DEVELOPER_READ_OPERATIONS,
  ...CONSOLE_READ_OPERATIONS,
  ...DESIGN_SYSTEM_READ_OPERATIONS,
  ...DESIGN_SYSTEM_SPECIMEN_SHARE_READ_OPERATIONS,
  ...SCHEMA_READ_OPERATIONS,
  ...LINKS_CONNECTIONS_READ_OPERATIONS,
  ...BUCKETS_READ_OPERATIONS,
  ...AGENTS_READ_OPERATIONS,
  ...FORMS_READ_OPERATIONS,
  ...PEOPLE_READ_OPERATIONS,
  ...TEMPLATES_READ_OPERATIONS,
]

/**
 * The area arrays the admin routes mount, re-exported HERE so a route module
 * reaches them through the registry. The Developers area's tools listing
 * reads the registry back (`mcp-tool-listing.ts`), so the registry must be the
 * module that enters that import cycle — an area file imported first would
 * find the registry's array still uninitialised.
 */
export {
  AGENTS_READ_OPERATIONS,
  AUDIT_LOG_READ_OPERATIONS,
  BUCKETS_READ_OPERATIONS,
  CONNECTIONS_READ_OPERATIONS,
  FORMS_READ_OPERATIONS,
  LINKS_READ_OPERATIONS,
  ORGANISATION_READ_OPERATIONS,
  USERS_READ_OPERATIONS,
  CONFIG_READ_OPERATIONS,
  CONSOLE_READ_OPERATIONS,
  DESIGN_SYSTEM_READ_OPERATIONS,
  DESIGN_SYSTEM_SPECIMEN_SHARE_READ_OPERATIONS,
  DEVELOPER_READ_OPERATIONS,
  RELEASE_READ_OPERATIONS,
  SCHEMA_READ_OPERATIONS,
  TEMPLATES_READ_OPERATIONS,
}

/** One registry entry, projected to the facts a parity check compares. */
export interface AdminReadOperationSummary {
  readonly id: string
  readonly method: 'get'
  /** Hono form (`/api/admin/x/:id`). */
  readonly path: string
  /** The name after `{app}_admin_`. */
  readonly toolSuffix: string
  readonly auditAction: string | undefined
}

/**
 * The registry as plain data — no programs, no schemas. Pure and side-effect
 * free, so a drift gate can import it and diff it against the mounted admin
 * GET routes and the compiled MCP admin tools.
 */
export const enumerateAdminReadOperations = (
  operations: ReadonlyArray<AdminReadOperation> = ADMIN_READ_OPERATIONS
): ReadonlyArray<AdminReadOperationSummary> =>
  operations.map((operation) => ({
    id: operation.id,
    method: operation.method,
    path: operation.path,
    toolSuffix: operation.tool.suffix,
    auditAction: operation.auditAction,
  }))

/** Every admin read tool name of `appName`, as a set. */
export const adminReadToolNames = (appName: string): ReadonlySet<string> =>
  new Set(
    ADMIN_READ_OPERATIONS.map((operation) => adminReadToolName(appName, operation.tool.suffix))
  )

/** The operation whose tool answers to `toolName` EXACTLY, or `undefined`. */
export const resolveAdminReadOperation = (
  appName: string,
  toolName: string
): AdminReadOperation | undefined =>
  ADMIN_READ_OPERATIONS.find(
    (operation) => adminReadToolName(appName, operation.tool.suffix) === toolName
  )

/**
 * The admin read tools an admin credential is offered, projected for display:
 * the exact name and the same description `tools/list` advertises.
 */
export const listAdminReadTools = (
  appName: string
): ReadonlyArray<{ readonly name: string; readonly description: string }> =>
  ADMIN_READ_OPERATIONS.map((operation) => ({
    name: adminReadToolName(appName, operation.tool.suffix),
    description: operation.tool.description,
  }))

/**
 * An admin route that answers `GET` and is nevertheless NOT a read.
 *
 * Some actions must be reachable by a browser redirect, so they are mounted as
 * `GET`. They change state, so no MCP read tool mirrors them: a route leaves the
 * read family by being classified an action HERE, beside the reads, never by an
 * ignore list in a gate.
 */
export interface AdminGetAction {
  /** Hono form, exactly as the route mounts it. */
  readonly path: string
  /** What the route changes, which is why it is an action and not a read. */
  readonly reason: string
}

/**
 * Every admin `GET` that is an action. Together with
 * {@link ADMIN_READ_OPERATIONS} it classifies every mounted `GET /api/admin/*`
 * route: the parity gate (`Admin MCP Parity`) fails on a mounted admin `GET`
 * that is in neither list, on an entry here that is no longer mounted, and on a
 * path that is in both.
 */
export const ADMIN_GET_ACTIONS: ReadonlyArray<AdminGetAction> = [
  {
    path: '/api/admin/connections/:name/callback',
    reason:
      'The OAuth provider redirects the browser here; the route exchanges the code and stores a token.',
  },
]
