/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Command Search Repository Port
 *
 * Type-safe data access for the global command-palette search API
 * (`GET /api/command-search`). Backed by two raw query concerns:
 *
 *   - loading the caller's favorited record ids (from `system.user_favorites`),
 *   - a per-table case-insensitive text search across a table's text-typed
 *     columns.
 *
 * Implementation lives in the infrastructure layer
 * (command-search-repository-live.ts). This port must not import infrastructure
 * — the row/input types below are defined here to keep the application layer
 * decoupled from Drizzle.
 */

/**
 * A per-table text-search request. `physicalTable` is the sanitized physical
 * table name; `columns` are the (validated, schema-derived) text column names
 * to search; `query` is the user-supplied search term (bound as a parameter).
 */
export interface TableSearchInput {
  readonly physicalTable: string
  readonly columns: readonly string[]
  readonly query: string
}

/**
 * A single matched record row: its `id` and a derived `label` (the first
 * non-empty searched text column, falling back to the id).
 */
export interface TableSearchMatch {
  readonly id: string
  readonly label: string
}

/**
 * Database error for command-search operations.
 */
export class CommandSearchDatabaseError extends Data.TaggedError('CommandSearchDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Command Search Repository Port.
 *
 * Methods map to a single raw query each; all orchestration (detail-path map,
 * page search, ranking/merging) lives in the use case.
 */
export class CommandSearchRepository extends Context.Tag('CommandSearchRepository')<
  CommandSearchRepository,
  {
    /**
     * Load the set of record entity ids the user has favorited (soft-deleted
     * favorites excluded). Returns an empty set when there is no session.
     */
    readonly loadFavoriteIds: (
      userId: string
    ) => Effect.Effect<ReadonlySet<string>, CommandSearchDatabaseError>

    /**
     * Search a single table's text columns for the query. Never fails: a
     * failing/unreadable table search resolves to an empty list rather than
     * throwing (a broken table is skipped, the rest of the search proceeds).
     */
    readonly searchTable: (
      input: TableSearchInput
    ) => Effect.Effect<readonly TableSearchMatch[], never>
  }
>() {}
