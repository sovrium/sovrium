/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { AdminSearchEntityType } from '@/domain/models/api/admin/search/search'
import type { Effect } from 'effect'

/**
 * Admin Global Search Repository Port — [internal ref].
 *
 * Type-safe data access for the admin-only, fully-indexed global search
 * (`GET /api/admin/search?q=`). Backed by the dedicated `_admin_search_index`
 * table (PostgreSQL `content_tsv` + GIN; SQLite content table + an FTS5 virtual
 * table — both work, the SQLite path does NOT degrade like the public record
 * search). The repository owns the two raw concerns the use case composes:
 *
 *   - {@link rebuildIndex} — the LAZY/ON-DEMAND repopulation: it reads each
 *     entity kind's EXISTING data source (table records, form submissions,
 *     automation runs, users, file names, agent conversations) and upserts a
 *     SECRET-FREE row per entity into `_admin_search_index`, stamping a fresh
 *     `built_at` marker. Connections are indexed by the use case from the live
 *     `app.connections[]` config (a secret-free label), not here.
 *   - {@link search} — the dialect-dispatched full-text query (`content_tsv @@`
 *     on PG / `…_fts MATCH` on SQLite) returning the matched index rows.
 *
 * Plus {@link indexStaleness}, the freshness probe the use case checks before
 * deciding whether to rebuild (empty OR older than the freshness window).
 *
 * This is a deliberately SEPARATE port from the public `command-search`
 * repository: that one is a per-table LIKE scan + favorites read shaped for the
 * command palette's page/record jump; this one is the cross-entity admin index.
 *
 * Implementation lives in the infrastructure layer
 * (admin-search-repository-live.ts). The row/input types below are defined here
 * so the application layer stays decoupled from Drizzle.
 */

/**
 * Database error for admin-search operations.
 */
export class AdminSearchDatabaseError extends Data.TaggedError('AdminSearchDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * A single matched index row (raw store shape). The use case projects this down
 * to the S4 allow-list response result.
 */
export interface AdminSearchIndexHit {
  readonly type: AdminSearchEntityType
  readonly entityId: string
  readonly title: string
  readonly href: string
  /** Source last-touch time, dialect-native (`Date` on PG, `Date | number` on SQLite). */
  readonly updatedAt: Date | string | number
}

/**
 * One row to upsert into the index during a rebuild. Heterogeneous across kinds;
 * `title`/`body` are ALWAYS secret-free (the use case + repo guarantee S4).
 */
export interface AdminSearchUpsertRow {
  readonly type: AdminSearchEntityType
  readonly entityId: string
  readonly title: string
  readonly body: string
  readonly href: string
  readonly updatedAt: Date
}

/**
 * The index freshness state the use case reads before deciding to rebuild.
 * `lastBuiltAt` is the newest `updated_at` across all index rows (the lazy
 * `built_at` marker proxy), or `undefined` when the index is empty.
 */
export interface AdminSearchStaleness {
  readonly isEmpty: boolean
  readonly lastBuiltAt: Date | undefined
}

/**
 * Admin Global Search Repository Port.
 */
export class AdminSearchRepository extends Context.Service<
  AdminSearchRepository,
  {
    /** Probe the index freshness (empty + newest row time) to gate a rebuild. */
    readonly indexStaleness: Effect.Effect<AdminSearchStaleness, AdminSearchDatabaseError>

    /**
     * Read every searchable source (records of `tables`, submissions, runs,
     * users, files, conversations) and upsert one secret-free index row per
     * entity. `extraRows` carries the config-derived connection rows the use
     * case assembled. Idempotent upsert on `(type, entity_id)`.
     */
    readonly rebuildIndex: (input: {
      readonly tables: ReadonlyArray<{
        readonly displayName: string
        readonly textColumns: readonly string[]
      }>
      readonly extraRows: readonly AdminSearchUpsertRow[]
    }) => Effect.Effect<void, AdminSearchDatabaseError>

    /**
     * Run the dialect-dispatched full-text query for `query`, returning the
     * matched index rows (capped per kind by the use case). Never fails on a
     * malformed FTS expression — an unparseable query resolves to `[]`.
     */
    readonly search: (
      query: string
    ) => Effect.Effect<readonly AdminSearchIndexHit[], AdminSearchDatabaseError>
  }
>()('AdminSearchRepository') {}
