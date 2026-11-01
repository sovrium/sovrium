/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A write that replaces nothing (`upload` in `create-only` mode): it fails, and
 * leaves what is there unchanged, when anything is stored at its key — an
 * object in the store, catalogued or not, or a catalog row. A caller that judged a key free uses it so that a file stored there
 * between that judgement and the write is kept.
 */

import { Clock, Effect } from 'effect'
import {
  storageKeyTaken,
  storageObjectNotFound,
} from '@/application/ports/services/storage-service'
import { bucketBindingPermitsWrite, readFileMetadata, type CatalogWrite } from './bytea-adapter'
import { releaseStaleClaim, settleClaim } from './catalog-claim'
import { assertNoOtherSpelling, type SpellingStore } from './catalog-guards'
import { claimThenCheck, releaseClaimQuietly } from './claim-then-check'
import { attemptStorage, toStorageError, type DriverCall } from './storage-attempt'
import type { BucketBinding, StorageError } from '@/application/ports/services/storage-service'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * The refusal of a create-only write at a key that holds something, in the
 * shape the stored object itself would answer: the not-found every write gets
 * when the catalog binds it to a bucket this write could not record (another
 * bucket's object is never told apart from an absent one), else the taken
 * marker — an object of this write's own binding, or one no row records.
 */
const refuseTaken = (
  client: PortableDb,
  key: string,
  bucket: BucketBinding
): Effect.Effect<never, StorageError> =>
  attemptStorage(() => readFileMetadata(client, key)).pipe(
    Effect.flatMap((row) =>
      Effect.fail(
        toStorageError(
          row === undefined || bucketBindingPermitsWrite(bucket, row.bucket)
            ? storageKeyTaken(key)
            : storageObjectNotFound(key)
        )
      )
    )
  )

/**
 * Create-only for a provider that keeps the bytes outside the catalog (S3,
 * local): the key is claimed with an insert-only row, which refuses when a row
 * or another writer's claim is there; then the other spellings of the key are
 * checked (`claim-then-check.ts`); then the bytes are created only where
 * nothing is stored (`writeBytes`, the store's own conditional write); then
 * the claim settles into the row. Bytes found at the key release the claim and
 * are left as they are. A claim released as stale meanwhile refuses, and the
 * bytes stay: by then the key may be another writer's.
 */
export const createOnlyOutsideCatalog = (input: {
  /** The catalog's database. */
  readonly client: PortableDb
  readonly catalog: CatalogWrite
  readonly store: Readonly<SpellingStore>
  readonly writeBytes: DriverCall<'written' | 'taken'>
}): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const { client } = input
    const { key, bucket } = input.catalog
    // A claim whose writer died is released, so a crash never blocks the key.
    const now = yield* Clock.currentTimeMillis
    yield* attemptStorage(() => releaseStaleClaim(client, key, now))
    const claim = yield* claimThenCheck(client, input.catalog, input.store)
    if (claim === undefined) return yield* refuseTaken(client, key, bucket)
    const bytes = yield* attemptStorage(input.writeBytes).pipe(
      Effect.tapError(() => releaseClaimQuietly(client, claim))
    )
    if (bytes === 'taken') {
      yield* releaseClaimQuietly(client, claim)
      return yield* refuseTaken(client, key, bucket)
    }
    if (yield* attemptStorage(() => settleClaim(client, claim))) return
    return yield* refuseTaken(client, key, bucket)
  }).pipe(Effect.withSpan('storage.create-only-outside-catalog'))

/** Create-only for the database provider: the row and its payload in one insert-only road. */
export const createOnlyInCatalog = (input: {
  /** The catalog's database. */
  readonly client: PortableDb
  readonly key: string
  readonly bucket: BucketBinding
  readonly store: Readonly<SpellingStore>
  readonly insert: DriverCall<'written' | 'taken'>
}): Effect.Effect<void, StorageError> =>
  assertNoOtherSpelling(input.client, input.key, input.bucket, input.store).pipe(
    Effect.andThen(attemptStorage(input.insert)),
    Effect.flatMap((written) =>
      written === 'written' ? Effect.void : refuseTaken(input.client, input.key, input.bucket)
    ),
    Effect.withSpan('storage.create-only-in-catalog')
  )
