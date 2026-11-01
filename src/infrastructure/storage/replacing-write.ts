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
 * the claim. The other spellings are checked only once the claim is held, so
 * two processes sharing one store and one catalog never both write two
 * spellings of one key (`claim-then-check.ts`).
 */

import { Clock, Effect } from 'effect'
import { storageObjectNotFound } from '@/application/ports/services/storage-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  bucketBindingPermitsWrite,
  readFileMetadata,
  writeFileMetadata,
  type CatalogWrite,
} from './bytea-adapter'
import {
  releaseStaleClaim,
  settleClaim,
  withdrawSettledClaim,
  type CatalogClaim,
} from './catalog-claim'
import { assertNoOtherSpelling, type SpellingStore } from './catalog-guards'
import { claimThenCheck, releaseClaimQuietly } from './claim-then-check'
import { attemptStorage, toStorageError, type DriverCall } from './storage-attempt'
import type { StorageError } from '@/application/ports/services/storage-service'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/** Another bucket's key, or one another writer took: never told apart from an absent one. */
const refuseAsAbsent = (key: string): Effect.Effect<never, StorageError> =>
  Effect.fail(toStorageError(storageObjectNotFound(key)))

/**
 * Bytes written beside their key, not yet at it: `commit` moves them into
 * place, `discard` removes them. What a store that can move a file in one step
 * (a local disk) offers, so a write is placed only once its claim is settled.
 */
export interface StagedWrite {
  readonly commit: () => Promise<void>
  readonly discard: () => Promise<void>
}

/** Remove staged bytes; a failure is logged, and leaves a file no listing shows. */
const discardQuietly = (staged: StagedWrite): Effect.Effect<void> =>
  attemptStorage(staged.discard).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[storage] staged bytes could not be removed', cause))
    ),
    // effect-swallow: the write already answers for itself; a staged file sits under a fresh random name no listing shows. Logged just above.
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Staged bytes that could not be moved to their key after the claim settled:
 * they are removed, and so is the row the claim settled into, so no row is
 * left describing a file that is not there. Either failure is logged.
 */
const abandonSettled = (
  client: PortableDb,
  staged: StagedWrite,
  claim: CatalogClaim
): Effect.Effect<void> =>
  discardQuietly(staged).pipe(
    Effect.andThen(attemptStorage(() => withdrawSettledClaim(client, claim))),
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[storage] a settled key with no bytes could not be removed', cause)
      )
    ),
    // effect-swallow: the failed move already answers for the write; a row left behind is replaced by the next write to the key. Logged just above.
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Store the bytes of a claimed key, releasing the claim when they cannot be
 * stored. Staged bytes reach the key only once the claim is settled: a writer
 * whose claim went stale while it wrote — and was taken by a newer writer —
 * finds no claim to settle, and its bytes are discarded instead of landing
 * over the newer writer's.
 */
const storeClaimed = (
  client: PortableDb,
  bytes: { readonly write: DriverCall<unknown> } | { readonly stage: () => Promise<StagedWrite> },
  claim: CatalogClaim
): Effect.Effect<void, StorageError> => {
  const release = releaseClaimQuietly(client, claim)
  // A claim released as stale meanwhile is no longer this write's row, even
  // when another writer has claimed the key since: the markers differ.
  const settle = attemptStorage(() => settleClaim(client, claim))
  if ('write' in bytes) {
    return attemptStorage(bytes.write).pipe(
      Effect.tapError(() => release),
      Effect.andThen(settle),
      Effect.flatMap((settled) => (settled ? Effect.void : refuseAsAbsent(claim.key)))
    )
  }
  return attemptStorage(bytes.stage).pipe(
    Effect.tapError(() => release),
    Effect.flatMap((staged) =>
      settle.pipe(
        Effect.tapError(() => discardQuietly(staged)),
        Effect.flatMap((settled) =>
          settled
            ? attemptStorage(staged.commit).pipe(
                Effect.tapError(() => abandonSettled(client, staged, claim))
              )
            : discardQuietly(staged).pipe(Effect.andThen(refuseAsAbsent(claim.key)))
        )
      )
    )
  )
}

/**
 * The replacing write: `writeBytes` stores the bytes, overwriting what is
 * there. See the module comment for the claim it takes on a free key.
 * `readRow` is the check (the catalog row at the key, a claim reading as
 * none): the seam a test places another writer behind.
 */
export const replaceOutsideCatalog = (input: {
  /** The catalog's database. */
  readonly client: PortableDb
  readonly catalog: CatalogWrite
  readonly store: Readonly<SpellingStore>
  readonly writeBytes: DriverCall<unknown>
  /** Write the bytes beside the key for a claimed write; absent, a claimed write uses `writeBytes`. */
  readonly stageBytes?: () => Promise<StagedWrite>
  readonly readRow?: (key: string) => ReturnType<typeof readFileMetadata>
}): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const { client } = input
    const { key, bucket } = input.catalog
    const now = yield* Clock.currentTimeMillis
    yield* attemptStorage(() => releaseStaleClaim(client, key, now))
    // A claim is invisible here: a key another writer is claiming reads as free.
    const readRow = input.readRow ?? ((rowKey: string) => readFileMetadata(client, rowKey))
    const row = yield* attemptStorage(() => readRow(key))
    if (!bucketBindingPermitsWrite(bucket, row?.bucket)) return yield* refuseAsAbsent(key)
    if (row !== undefined) {
      // The row is settled and visible to every other writer's check: no claim needed.
      yield* assertNoOtherSpelling(client, key, bucket, input.store)
      yield* attemptStorage(input.writeBytes)
      return yield* attemptStorage(() => writeFileMetadata(client, input.catalog))
    }
    // A free key: claim it, then check the other spellings (`claim-then-check.ts`).
    const claim = yield* claimThenCheck(client, input.catalog, input.store)
    if (claim === undefined) return yield* refuseAsAbsent(key)
    const { stageBytes } = input
    return yield* storeClaimed(
      client,
      stageBytes === undefined ? { write: input.writeBytes } : { stage: stageBytes },
      claim
    )
  }).pipe(Effect.withSpan('storage.replace-outside-catalog'))
