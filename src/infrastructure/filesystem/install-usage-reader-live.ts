/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { Effect, Layer } from 'effect'
import {
  InstallUsageReader,
  UsageReadError,
  type CatalogueStore,
} from '@/application/ports/services/install-usage-reader'
import { isMissing, withReadOnlySqlite, withShortLivedPostgres } from './install-store-clients'

/** The error code a failure carries, never its message: a driver's message may quote the URL. */
const codeOf = (cause: unknown): string => {
  const code = (cause as { readonly code?: unknown } | null)?.code
  return typeof code === 'string' ? ` (${code})` : ''
}

const attempt = (reason: string, run: (signal: AbortSignal) => Promise<number>) =>
  Effect.tryPromise({
    try: (signal) => run(signal),
    catch: (cause) => new UsageReadError({ reason: `${reason}${codeOf(cause)}`, cause }),
  })

/** The size of one file without following a link; a missing file is 0. */
const fileSize = async (path: string): Promise<number> => {
  try {
    const found = await lstat(path)
    return found.isFile() ? found.size : 0
  } catch (cause) {
    if (isMissing(cause)) return 0
    throw cause
  }
}

/**
 * The bytes of every regular file below `directory`; links are neither counted
 * nor followed. Walked one entry at a time, so a storage directory of a
 * hundred thousand files never holds a hundred thousand stats in flight.
 */
export const treeSize = async (
  directory: string,
  sizeOf: (path: string) => Promise<number> = fileSize
): Promise<number> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch((cause: unknown) => {
    if (isMissing(cause)) return []
    throw cause
  })
  return entries.reduce<Promise<number>>(async (running, entry) => {
    const total = await running
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return total + (await treeSize(path, sizeOf))
    return entry.isFile() ? total + (await sizeOf(path)) : total
  }, Promise.resolve(0))
}

/** The provider value the storage catalogue records for each store. */
const CATALOGUE_PROVIDER: Readonly<Record<CatalogueStore, string>> = {
  s3: 's3',
  database: 'bytea',
}

const sqliteCatalogueBytes = (path: string, provider: string): number =>
  withReadOnlySqlite(path, (database) => {
    const row = database
      .query<{ readonly n: number | null }, [string]>(
        'SELECT sum(size) AS n FROM system_file_storage_metadata WHERE storage_provider = ?'
      )
      .get(provider)
    return Number(row?.n ?? 0)
  })

/**
 * The usage measure gives up connecting after a few seconds and is closed at
 * once when the caller's bound runs out: a hosting machine's usage unit must
 * finish even when the database never answers.
 */
const postgresOptions = (signal: AbortSignal) => ({ connectionTimeout: 10, signal })

const postgresCatalogueBytes = (
  url: string,
  provider: string,
  signal: AbortSignal
): Promise<number> =>
  withShortLivedPostgres(
    url,
    async (sql) => {
      const rows: readonly { readonly n: string | number | null }[] =
        await sql`SELECT sum(size)::bigint AS n FROM system.file_storage_metadata WHERE storage_provider = ${provider}`
      return Number(rows[0]?.n ?? 0)
    },
    postgresOptions(signal)
  )

const postgresDatabaseSize = (url: string, signal: AbortSignal): Promise<number> =>
  withShortLivedPostgres(
    url,
    async (sql) => {
      const rows: readonly { readonly n: string | number }[] =
        await sql`SELECT pg_database_size(current_database())::bigint AS n`
      return Number(rows[0]?.n ?? 0)
    },
    postgresOptions(signal)
  )

/** `InstallUsageReader` over the filesystem, `bun:sqlite` and `Bun.SQL`. Reads only. */
export const InstallUsageReaderLive = Layer.succeed(
  InstallUsageReader,
  InstallUsageReader.of({
    filesBytes: (paths) =>
      attempt('the database files could not be read', async () =>
        (await Promise.all(paths.map(fileSize))).reduce((total, size) => total + size, 0)
      ),
    treeBytes: (directory) =>
      attempt('the storage directory could not be read', () => treeSize(directory)),
    postgresDatabaseBytes: (url) =>
      attempt('the database could not be reached to measure its size', (signal) =>
        postgresDatabaseSize(url, signal)
      ),
    catalogueBytes: (database, store) =>
      database.dialect === 'sqlite'
        ? attempt('the storage catalogue could not be read from the database', async () =>
            sqliteCatalogueBytes(database.path, CATALOGUE_PROVIDER[store])
          )
        : attempt('the database could not be reached to read the storage catalogue', (signal) =>
            postgresCatalogueBytes(database.url, CATALOGUE_PROVIDER[store], signal)
          ),
  })
)
