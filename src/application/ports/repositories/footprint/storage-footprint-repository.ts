/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Storage-Footprint Repository Port.
 *
 * Backs the storage panel of `GET /api/admin/footprint/overview`: the physical
 * size, in bytes, of each configured table plus the whole-database total.
 *
 * WHY THIS IS ITS OWN PORT (and not a method on `TablesOverviewRepository`)
 * ------------------------------------------------------------------------
 * `TablesOverviewRepository` is architected around a **per-table fan-out
 * budget** — "at most one query per configured table", bounded by an explicit
 * concurrency ceiling. That invariant is the documented fix for the 2026-07-25
 * production 504, and its live implementation carries a file-level doc comment
 * saying so.
 *
 * Physical size is answered by a completely different shape: **one catalog
 * query for every table at once** (`pg_class` on PostgreSQL, `dbstat` on
 * SQLite). Folding that into the fan-out repository would contradict that
 * file's own stated invariant — and folding the fan-out discipline onto a
 * catalog read would multiply a single statement by the table count for no
 * reason. Two different cost models, two ports.
 *
 * THREE STATES, NEVER A SILENT ZERO
 * ---------------------------------
 * `bytes` is nullable on purpose, and the two falsy-looking values are NOT
 * interchangeable:
 *
 *   - `0`    — the probe RAN and the relation is empty.
 *   - `null` — the probe could not run; nothing was measured.
 *
 * `measurement` states which of those happened, and the two are strictly
 * coupled: `bytes === null` if and only if `measurement === 'unavailable'`.
 * That coupling is what makes `0` legible. It exists because the panel
 * previously shipped a hardcoded `bytes: 0` for every table — a fabricated
 * number indistinguishable from a measured one, which is exactly what [internal ref]
 * D6 Verification #4 (cite the measurement source) forbids.
 *
 * The SQLite arm needs the coupling most: `dbstat` is a COMPILE-TIME SQLite
 * option (`SQLITE_ENABLE_DBSTAT_VTAB`), and Bun exposes
 * `Database.setCustomSQLite()`, so an operator can be running a build without
 * it. Such a deployment reports `unavailable`, never `0`.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Where a per-table byte count came from.
 *
 * Deliberately narrower than the wire-level `StorageMeasurementSource` in
 * `domain/models/api/admin/footprint/overview.ts`: a TABLE row can never cite
 * `'storage_adapter'`, because the object-storage adapter cannot see a table.
 * The route assembles both kinds of row into the wider wire union, so any
 * literal that drifts out of the wire enum fails typecheck at that seam.
 */
export type TableSizeMeasurement = 'pg_total_relation_size' | 'sqlite_dbstat' | 'unavailable'

/** Physical size of one configured table, with the provenance of the number. */
export interface TableSizeRow {
  readonly tableName: string
  /** Measured bytes, or `null` when the sizing probe was unavailable. */
  readonly bytes: number | null
  readonly measurement: TableSizeMeasurement
}

/**
 * One database-wide footprint reading: per-table sizes plus the whole-database
 * total.
 *
 * `totalBytes` is a SEPARATE figure and is never attributed to a table row —
 * a database-wide number presented as a per-table one is the same class of lie
 * as a fabricated per-table count. It is sourced from a whole-database
 * primitive (`pg_database_size` / SQLite's page count × page size), both of
 * which remain available even when per-table sizing does not.
 */
export interface DatabaseFootprint {
  readonly tables: readonly TableSizeRow[]
  readonly totalBytes: number
}

/** Database error for storage-footprint lookups. */
export class StorageFootprintError extends Data.TaggedError('StorageFootprintError')<{
  readonly cause: unknown
}> {}

/**
 * Storage-Footprint Repository Port.
 *
 * `measureDatabaseFootprint` takes the configured (sanitized) table names and
 * returns one row per input name, in input order. A name absent from the
 * catalog — a table the engine has not created yet, or one removed at config
 * time — yields `bytes: null` / `measurement: 'unavailable'` rather than `0`,
 * because "not there" is not "empty".
 */
export class StorageFootprintRepository extends Context.Service<
  StorageFootprintRepository,
  {
    readonly measureDatabaseFootprint: (
      tableNames: ReadonlyArray<string>
    ) => Effect.Effect<DatabaseFootprint, StorageFootprintError>
  }
>()('StorageFootprintRepository') {}
