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
 * What a column can hold, as the engine's catalogue declares it, folded into
 * the few families a `where` value is checked against before any SQL runs.
 *
 * - `boolean`: a PostgreSQL `boolean`.
 * - `number`: a numeric column.
 * - `number-or-boolean`: a SQLite integer-affinity column, which is also how
 *   SQLite stores a boolean and an epoch-millisecond time.
 * - `time`: a PostgreSQL timestamp or date.
 * - `uuid`: a PostgreSQL `uuid`.
 * - `text`: a character column.
 * - `json`: a JSON column, never filterable by equality.
 * - `other`: a type the check does not know; the database decides.
 */
export type McpInternalColumnKind =
  'boolean' | 'number' | 'number-or-boolean' | 'time' | 'uuid' | 'text' | 'json' | 'other'

/** One physical column of an internal table, as the catalogue reports it. */
export interface McpInternalColumn {
  /** The physical name, snake_case on both dialects. */
  readonly name: string
  readonly kind: McpInternalColumnKind
}

/** One `column = value` equality of a list's `where`, column and value already validated. */
export interface McpInternalEquality {
  /** A physical column of the table — checked against {@link McpInternalsRepository.listColumns}. */
  readonly column: string
  /** The column's family, so the repository compares the bound value as that type. */
  readonly kind: McpInternalColumnKind
  /** Bound as a parameter, never spliced; `null` reads as `IS NULL`. Fits `kind`. */
  readonly value: string | number | boolean | null
}

/**
 * A validated internal list query. Every column name in it was checked by the
 * caller against the table's own columns, minus its denylist; every value is
 * bound as a parameter by the repository (S3).
 */
export interface McpInternalListQuery {
  /** Rows per page, already clamped to `[1, 1000]`. */
  readonly limit: number
  /**
   * The column the rows are ordered by, newest first, and `since` applies to.
   * `undefined` when the table has none: the order is then `id` descending.
   */
  readonly timeColumn: string | undefined
  /** Keep the rows whose time column is at or after this instant. Requires `timeColumn`. */
  readonly since: Date | undefined
  readonly where: ReadonlyArray<McpInternalEquality>
  /** The `id` of the last row of the previous page; the page continues strictly after it. */
  readonly after: string | undefined
}

/**
 * Read port over the admin-internal table registry — the `SELECT` half of the
 * generic `{app}_{schema}_{table}_{list,read}` MCP tools.
 *
 * It takes an `InternalTableEntry` — a DOMAIN value — rather than a table name,
 * and that is load-bearing. The entry carries the schema (`auth` vs `system`),
 * which decides how the reference is namespaced: `auth.session` /
 * `system."links"` on PostgreSQL against the flat `auth_session` /
 * `system_links` on SQLite. A port taking a bare string would push that
 * decision back to the caller, where a Postgres-only `${schema}.${name}` splice
 * raises "no such table" on the zero-config default engine.
 *
 * It keeps the live `db` handle and raw statements out of
 * `route-setup/mcp/internals.ts`.
 */
export class McpInternalsRepository extends Context.Service<
  McpInternalsRepository,
  {
    /**
     * The physical columns of an internal table and their types, as the
     * engine's catalogue declares them (names snake_case on both dialects). The
     * caller validates `where` — names and values — and picks the time column
     * against this list, so no name a client typed ever reaches SQL unchecked,
     * and no value its column cannot hold reaches the database.
     */
    readonly listColumns: (
      entry: Readonly<InternalTableEntry>
    ) => Effect.Effect<ReadonlyArray<McpInternalColumn>, McpInternalsDatabaseError>

    /**
     * One page of an internal table: newest first by `query.timeColumn` (then
     * `id` descending as the tie-break), or `id` descending when there is none,
     * filtered by `since` and the `where` equalities, continuing after the
     * `after` row.
     */
    readonly listRows: (
      entry: Readonly<InternalTableEntry>,
      query: McpInternalListQuery
    ) => Effect.Effect<ReadonlyArray<McpInternalRow>, McpInternalsDatabaseError>

    /** The row with this `id`, or `undefined` for a miss. */
    readonly readRow: (
      entry: Readonly<InternalTableEntry>,
      id: string
    ) => Effect.Effect<McpInternalRow | undefined, McpInternalsDatabaseError>
  }
>()('McpInternalsRepository') {}
