/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/**
 * A size that could not be read. `reason` is written for the operator and
 * carries no credential: never a connection URL, never a secret.
 */
export class UsageReadError extends Data.TaggedError('UsageReadError')<{
  readonly reason: string
  readonly cause?: unknown
}> {}

/** Which store's files the storage catalogue is summed for. */
export type CatalogueStore = 's3' | 'database'

/** The database whose catalogue is read. */
export type CatalogueDatabase =
  | { readonly dialect: 'sqlite'; readonly path: string }
  | { readonly dialect: 'postgres'; readonly url: string }

/**
 * The sizes `sovrium usage` reads outside the process. Every call is a read:
 * none writes, none opens a SQLite file for a size the filesystem answers.
 */
export class InstallUsageReader extends Context.Service<
  InstallUsageReader,
  {
    /** The bytes of these files on disk, a missing file counting 0. */
    readonly filesBytes: (paths: readonly string[]) => Effect.Effect<number, UsageReadError>
    /**
     * The bytes of every regular file under `directory`, at any depth, no link
     * followed; a missing directory counts 0.
     */
    readonly treeBytes: (directory: string) => Effect.Effect<number, UsageReadError>
    /** `pg_database_size` of the database the URL names. */
    readonly postgresDatabaseBytes: (url: string) => Effect.Effect<number, UsageReadError>
    /** The sum of the sizes the storage catalogue records for one store. */
    readonly catalogueBytes: (
      database: CatalogueDatabase,
      store: CatalogueStore
    ) => Effect.Effect<number, UsageReadError>
  }
>()('InstallUsageReader') {}
