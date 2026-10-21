/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claim a free key, THEN check the other spellings of it: the order that
 * serialises writers across processes without a lock.
 *
 * Nothing in the catalog is unique by comparison form, so two new keys that
 * are spellings of each other (`Brief.txt`, `brief.txt`), written at the same
 * moment by two processes sharing one store and one catalog, could both check,
 * both find the other absent, and both land on the one file a folding disk
 * keeps for them. The in-process spelling lock cannot see the other process.
 *
 * So each writer first inserts its own claim row — committed on its own, before
 * anything else — and only then looks for another spelling, claims included
 * (`findOtherStoredSpelling` sees a live claim). Of two such writers, the
 * second to check always runs after the first one's claim is committed, so at
 * least one of them sees the other: they can never both write. Both may refuse,
 * which costs a retry and never data. A writer that finds another spelling
 * releases its own claim, exactly its own (the marker), and refuses with the
 * answer the stored key would give; no byte has been written by then.
 */

import { Effect } from 'effect'
import { StorageError } from '@/application/ports/services/storage-service'
import { logError } from '@/infrastructure/logging/logger'
import { claimProviderOf, releaseClaim, type CatalogClaim } from './catalog-claim'
import { assertNoOtherSpelling, insertFileMetadataOnly, type SpellingStore } from './catalog-guards'
import type { CatalogWrite } from './bytea-adapter'

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, StorageError> =>
  Effect.tryPromise({ try: run, catch: (e: unknown) => new StorageError({ cause: e }) })

/** Remove `claim`, and only it; a failure is logged, never raised over the write's own answer. */
export const releaseClaimQuietly = (claim: CatalogClaim): Effect.Effect<void> =>
  attempt(() => releaseClaim(claim)).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[storage] a claimed key could not be released', cause))
    ),
    // effect-swallow: the write already answers for itself; a claim left behind is released by the next write to the key once stale, and is ignored by the spelling check by then. Logged just above.
    Effect.orElseSucceed(() => undefined)
  )

/**
 * Claim `catalog.key` with a row of this writer's own marker, then refuse if
 * another spelling of the key is stored or being written. `undefined` when the
 * key itself is already taken — a row or another writer's claim — in which case
 * nothing was inserted. The claim comes back only once the check has passed.
 */
export const claimThenCheck = (
  catalog: CatalogWrite,
  store: Readonly<SpellingStore>
): Effect.Effect<CatalogClaim | undefined, StorageError> =>
  Effect.gen(function* () {
    const token = yield* Effect.sync(() => crypto.randomUUID())
    const claim: CatalogClaim = {
      key: catalog.key,
      provider: catalog.storageProvider,
      marker: claimProviderOf(catalog.storageProvider, token),
    }
    const inserted = yield* attempt(() =>
      insertFileMetadataOnly({ ...catalog, storageProvider: claim.marker })
    )
    if (inserted === 'taken') return undefined
    yield* assertNoOtherSpelling(catalog.key, catalog.bucket, store).pipe(
      Effect.tapError(() => releaseClaimQuietly(claim))
    )
    return claim
  }).pipe(Effect.withSpan('storage.claim-then-check'))
