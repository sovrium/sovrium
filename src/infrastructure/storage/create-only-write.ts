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
  StorageError,
  storageKeyTaken,
  storageObjectNotFound,
} from '@/application/ports/services/storage-service'
import { bucketBindingPermitsWrite, readFileMetadata, type CatalogWrite } from './bytea-adapter'
import { releaseStaleClaim, settleClaim } from './catalog-claim'
import { assertNoOtherSpelling, type SpellingStore } from './catalog-guards'
import { claimThenCheck, releaseClaimQuietly } from './claim-then-check'
import type { BucketBinding } from '@/application/ports/services/storage-service'

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, StorageError> =>
  Effect.tryPromise({ try: run, catch: (e: unknown) => makeError(e) })

/**
 * The refusal of a create-only write at a key that holds something, in the
 * shape the stored object itself would answer: the not-found every write gets
 * when the catalog binds it to a bucket this write could not record (another
 * bucket's object is never told apart from an absent one), else the taken
 * marker — an object of this write's own binding, or one no row records.
 */
const refuseTaken = (key: string, bucket: BucketBinding): Effect.Effect<never, StorageError> =>
  attempt(() => readFileMetadata(key)).pipe(
    Effect.flatMap((row) =>
      Effect.fail(
        makeError(
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
  readonly catalog: CatalogWrite
  readonly store: Readonly<SpellingStore>
  readonly writeBytes: () => Promise<'written' | 'taken'>
}): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const { key, bucket } = input.catalog
    // A claim whose writer died is released, so a crash never blocks the key.
    const now = yield* Clock.currentTimeMillis
    yield* attempt(() => releaseStaleClaim(key, now))
    const claim = yield* claimThenCheck(input.catalog, input.store)
    if (claim === undefined) return yield* refuseTaken(key, bucket)
    const bytes = yield* attempt(input.writeBytes).pipe(
      Effect.tapError(() => releaseClaimQuietly(claim))
    )
    if (bytes === 'taken') {
      yield* releaseClaimQuietly(claim)
      return yield* refuseTaken(key, bucket)
    }
    if (yield* attempt(() => settleClaim(claim))) return
    return yield* refuseTaken(key, bucket)
  }).pipe(Effect.withSpan('storage.create-only-outside-catalog'))

/** Create-only for the database provider: the row and its payload in one insert-only road. */
export const createOnlyInCatalog = (input: {
  readonly key: string
  readonly bucket: BucketBinding
  readonly store: Readonly<SpellingStore>
  readonly insert: () => Promise<'written' | 'taken'>
}): Effect.Effect<void, StorageError> =>
  assertNoOtherSpelling(input.key, input.bucket, input.store).pipe(
    Effect.andThen(attempt(input.insert)),
    Effect.flatMap((written) =>
      written === 'written' ? Effect.void : refuseTaken(input.key, input.bucket)
    ),
    Effect.withSpan('storage.create-only-in-catalog')
  )
