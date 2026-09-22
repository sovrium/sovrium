/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { InternalTableEntry } from '@/domain/models/app/tables/internal-tables'

/** Database error for the admin-internal MCP table reads. */
export class McpInternalsDatabaseError extends Data.TaggedError('McpInternalsDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * One row of an internal table, as it comes off the driver.
 *
 * Deliberately untyped past `unknown`: the registry spans a dozen tables with
 * no shared shape, and the tool contract is "whatever this table holds, minus
 * its denylist". Naming a row type here would be a fiction.
 *
 * DENYLIST STRIPPING IS NOT DONE HERE. The caller applies it, because the
 * denylist is registry data attached to the tool definition and the same rows
 * reach a differently-projected tier-1 handler. See `mcp/internals.ts`.
 */
export type McpInternalRow = Readonly<Record<string, unknown>>

/**
 * Read port over the admin-internal table registry — the `SELECT` half of the
 * generic `{app}_{schema}_{table}_{list,read}` MCP tools.
 *
 * It takes an `InternalTableEntry` — a DOMAIN value — rather than a table name,
 * and that is load-bearing. The entry carries the schema (`auth` vs `system`),
 * which decides how the reference is namespaced: `auth.session` /
 * `system."links"` on PostgreSQL against the flat `auth_session` /
 * `system_links` on SQLite. A port taking a bare string would have pushed that
 * decision back to the caller, which is where the Postgres-only
 * `${schema}.${name}` splice used to live and raise "no such table" on the
 * zero-config default engine.
 *
 * Introduced in W5b of the layout programme to retire the live `db` handle and
 * the two raw statements from `route-setup/mcp/internals.ts`.
 */
export class McpInternalsRepository extends Context.Service<
  McpInternalsRepository,
  {
    /**
     * Up to `limit` rows of an internal table.
     *
     * UNORDERED, and honestly so: not every internal table has a stable
     * ordering column (`auth.organization` has no `created_at`), and the MCP
     * specification promises no list ordering for internal tools.
     *
     * `limit` arrives already clamped to `[1, 1000]` by the caller's argument
     * validation.
     */
    readonly listRows: (
      entry: Readonly<InternalTableEntry>,
      limit: number
    ) => Effect.Effect<ReadonlyArray<McpInternalRow>, McpInternalsDatabaseError>

    /** The row with this `id`, or `undefined` for a miss. */
    readonly readRow: (
      entry: Readonly<InternalTableEntry>,
      id: string
    ) => Effect.Effect<McpInternalRow | undefined, McpInternalsDatabaseError>
  }
>()('McpInternalsRepository') {}
