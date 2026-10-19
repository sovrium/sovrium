/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A replacing write (`upload` in `replace` mode) for a provider that keeps the
 * bytes outside the catalog (S3, local).
 *
 * A key whose catalog row exists at the check, in a binding this write may
 * record, is replaced as it always was: bytes, then the guarded upsert. A key
 * the check finds FREE is CLAIMED first ({@link claimProviderOf}): the row is
 * inserted, never upserted, before any byte is stored. A create-only write
 * racing it then loses the row race and refuses, as it already does; and when
 * this write loses it — a row appeared after the check — it refuses in the
 * not-found shape and stores nothing, so a row another writer created never
 * ends up describing this write's bytes. Bytes that cannot be stored release
 * the claim. Two processes sharing one store and one catalog are not
 * serialised by the in-process spelling lock; the row is what decides.
 */

import { Clock, Effect } from 'effect'
import { StorageError, storageObjectNotFound } from '@/application/ports/services/storage-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  bucketBindingPermitsWrite,
  readFileMetadata,
  writeFileMetadata,
  type CatalogWrite,
} from './bytea-adapter'
import {
  claimProviderOf,
  releaseClaim,
  releaseStaleClaim,
  settleClaim,
  type CatalogClaim,
} from './catalog-claim'
import { assertNoOtherSpelling, insertFileMetadataOnly, type SpellingStore } from './catalog-guards'

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, StorageError> =>
  Effect.tryPromise({ try: run, catch: (e: unknown) => makeError(e) })

/** Another bucket's key, or one another writer took: never told apart from an absent one. */
const refuseAsAbsent = (key: string): Effect.Effect<never, StorageError> =>
  Effect.fail(makeError(storageObjectNotFound(key)))

/** Store the bytes of a claimed key, releasing the claim when they cannot be stored. */
const storeClaimed = (
  writeBytes: () => Promise<unknown>,
  claim: CatalogClaim
): Effect.Effect<void, StorageError> => {
  const release = attempt(() => releaseClaim(claim)).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[storage] a claimed key could not be released', cause))
    ),
    // effect-swallow: the write already failed and reports that; a claim left behind is released by the next write once stale, logged just above.
    Effect.orElseSucceed(() => undefined)
  )
  return attempt(writeBytes).pipe(
    Effect.tapError(() => release),
    Effect.andThen(attempt(() => settleClaim(claim))),
    // A claim released as stale meanwhile is no longer this write's row, even
    // when another writer has claimed the key since: the markers differ.
    Effect.flatMap((settled) => (settled ? Effect.void : refuseAsAbsent(claim.key)))
  )
}

/**
 * The replacing write: `writeBytes` stores the bytes, overwriting what is
 * there. See the module comment for the claim it takes on a free key.
 * `readRow` is the check (the catalog row at the key, a claim reading as
 * none): the seam a test places another writer behind.
 */
export const replaceOutsideCatalog = (input: {
  readonly catalog: CatalogWrite
  readonly store: Readonly<SpellingStore>
  readonly writeBytes: () => Promise<unknown>
  readonly readRow?: typeof readFileMetadata
}): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const { key, bucket, storageProvider } = input.catalog
    const now = yield* Clock.currentTimeMillis
    yield* attempt(() => releaseStaleClaim(key, now))
    // A claim is invisible here: a key another writer is claiming reads as free.
    const row = yield* attempt(() => (input.readRow ?? readFileMetadata)(key))
    if (!bucketBindingPermitsWrite(bucket, row?.bucket)) return yield* refuseAsAbsent(key)
    yield* assertNoOtherSpelling(key, bucket, input.store)
    if (row !== undefined) {
      return yield* attempt(() => input.writeBytes().then(() => writeFileMetadata(input.catalog)))
    }
    const token = yield* Effect.sync(() => crypto.randomUUID())
    const claim = {
      key,
      provider: storageProvider,
      marker: claimProviderOf(storageProvider, token),
    }
    const claimRow = { ...input.catalog, storageProvider: claim.marker }
    if ((yield* attempt(() => insertFileMetadataOnly(claimRow))) === 'taken') {
      return yield* refuseAsAbsent(key)
    }
    return yield* storeClaimed(input.writeBytes, claim)
  }).pipe(Effect.withSpan('storage.replace-outside-catalog'))
