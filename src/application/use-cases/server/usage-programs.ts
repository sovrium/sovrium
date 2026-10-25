/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Duration, Effect } from 'effect'
import {
  InstallUsageReader,
  UsageReadError,
} from '@/application/ports/services/install-usage-reader'
import type { CatalogueDatabase } from '@/application/ports/services/install-usage-reader'
import type { UsageReport } from '@/domain/models/app/automations/actions/instance/usage'

/** Where uploaded files live, as the process environment resolved it. */
export type UsageStorageSource =
  | { readonly provider: 'local'; readonly directory: string }
  | { readonly provider: 's3' }
  | { readonly provider: 'database' }

/** What `sovrium usage` measures: the install `sovrium start` would boot. */
export interface UsageRequest {
  readonly database: CatalogueDatabase
  readonly storage: UsageStorageSource
  readonly now: Readonly<Date>
}

type Figure = 'databaseBytes' | 'filesBytes'

/**
 * How long one figure may take, connection AND query: a database that accepts
 * the connection and never answers is `null` within this bound, so the usage
 * unit of a host never holds its slot until systemd kills it.
 */
const FIGURE_BOUND_SECONDS = 15

/** A figure, or `null` with the reason it could not be measured. */
const measured = (figure: Figure, read: Effect.Effect<number, UsageReadError>) =>
  Effect.timeoutOrElse(read, {
    duration: Duration.seconds(FIGURE_BOUND_SECONDS),
    orElse: () =>
      Effect.fail(
        new UsageReadError({
          reason: `the measurement timed out after ${String(FIGURE_BOUND_SECONDS)} seconds`,
        })
      ),
  }).pipe(
    Effect.map((bytes) => ({ bytes, unmeasured: [] as const })),
    Effect.catch((error) =>
      Effect.succeed({ bytes: null, unmeasured: [{ figure, reason: error.reason }] as const })
    )
  )

/**
 * How many bytes the install holds: its database and its stored files.
 *
 * SQLite is the database file and its write-ahead log on disk; PostgreSQL is
 * `pg_database_size`. Local files are the bytes under the storage directory,
 * no link followed. Files in S3 or in the database are the sizes the storage
 * catalogue recorded for that store: one query, no request to the bucket. A
 * figure that cannot be measured is `null` and listed in `unmeasured`; the
 * measure itself never fails.
 */
export const measureInstallUsage = Effect.fn('server.measure-install-usage')(function* (
  request: UsageRequest
) {
  const reader = yield* InstallUsageReader
  const { database, storage } = request
  const databaseFigure = yield* measured(
    'databaseBytes',
    database.dialect === 'sqlite'
      ? reader.filesBytes([database.path, `${database.path}-wal`])
      : reader.postgresDatabaseBytes(database.url)
  )
  const filesFigure = yield* measured(
    'filesBytes',
    storage.provider === 'local'
      ? reader.treeBytes(storage.directory)
      : reader.catalogueBytes(database, storage.provider)
  )
  const report: UsageReport = {
    database: database.dialect === 'sqlite' ? 'sqlite' : 'postgresql',
    databaseBytes: databaseFigure.bytes,
    storage: storage.provider,
    filesBytes: filesFigure.bytes,
    measuredAt: request.now.toISOString(),
    unmeasured: [...databaseFigure.unmeasured, ...filesFigure.unmeasured],
  }
  return report
})
