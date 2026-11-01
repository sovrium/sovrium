/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import --apply` — storing the imported bucket files in the
 * instance's own bucket store, under the same path in the same bucket, through
 * the storage service the server reads from, so the app serves each one at
 * `/api/buckets/<bucket>/files/<path>`. Part of the seed family: it writes
 * through storage as `@asset:` references do.
 */

import { Data, Effect } from 'effect'
import { StorageService } from '@/application/ports/services'
import { applyDatabaseMigrations, refuse, requireApp } from '@/cli/commands/app-prelude'
import { seededBucketPath } from '@/cli/commands/import/write-buckets'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { SeedStorageLive } from './database'
import type { BucketFileCopy } from '@/domain/models/import/accounts-buckets-mapper-service'

/** A seeded bucket file that could not be read back from `seed/import/buckets/`. */
class BucketFileReadError extends Data.TaggedError('BucketFileReadError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Store each seeded bucket file in the instance's bucket store, under its path
 * in its bucket. The app's migrations are applied first unless the seed run
 * just applied them.
 */
export const storeBucketFiles = async (
  configPath: string,
  projectRoot: string,
  input: { readonly files: readonly BucketFileCopy[]; readonly migrated: boolean }
): Promise<void> => {
  if (input.files.length === 0) return
  if (!input.migrated) {
    const { app, authoredTableIds } = await requireApp(configPath)
    await applyDatabaseMigrations(app, { authoredTableIds })
  }
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* Effect.forEach(
      input.files,
      (file) =>
        Effect.gen(function* () {
          const bytes = new Uint8Array(
            yield* Effect.tryPromise({
              try: () => Bun.file(seededBucketPath(projectRoot, file)).arrayBuffer(),
              catch: (cause) =>
                new BucketFileReadError({
                  message: `bucket file ${file.bucket}/${file.path} could not be read`,
                  cause,
                }),
            })
          )
          yield* storage.upload(file.path, bytes, inferMimeFromKey(file.path), file.bucket)
        }),
      { discard: true }
    )
  })
  // A step of the seed command's async run; the run stays where it is awaited.
  await Effect.runPromise(Effect.provide(program, SeedStorageLive)).catch((error: unknown) =>
    refuse(
      `Error: storing the bucket files failed: ${error instanceof Error ? error.message : String(error)}`
    )
  )
}
