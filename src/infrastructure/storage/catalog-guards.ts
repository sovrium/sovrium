/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The catalog checks every provider runs before it touches an object: the
 * bucket binding of a read, the binding a write may record, and the second
 * spellings a write would land on.
 */

import { Effect, Option, Semaphore } from 'effect'
import {
  StorageError,
  UNATTRIBUTED_BUCKET,
  storageKeySpellingTaken,
  storageObjectNotFound,
} from '@/application/ports/services/storage-service'
import { storageKeyCollisionForm } from '@/domain/kernel/identity/storage-key'
import { bucketBindingMatches, bucketBindingPermitsWrite, readFileMetadata } from './bytea-adapter'
import { findOtherStoredSpelling } from './key-spelling-catalog'
import type {
  BucketBinding,
  StorageService,
  StoredSpelling,
} from '@/application/ports/services/storage-service'
import type { StorageKeyComparison } from '@/domain/kernel/identity/storage-key'

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

/** How one provider's store tells keys apart, and which catalog rows are its own. */
export type SpellingStore = StorageKeyComparison & { readonly provider: string }

/**
 * Refuse an operation whose caller named a bucket the object does not belong
 * to — or that belongs to no recorded bucket at all.
 *
 * Storage keys are FLAT, so without this every declared bucket addresses the
 * same objects and the bucket in the URL only chooses which permission block
 * runs. The failure is shaped as "File not found" so the route answers 404,
 * never distinguishing "wrong bucket" from "absent" to a caller.
 */
export const assertBucketBinding = (
  key: string,
  bucket: BucketBinding
): Effect.Effect<void, StorageError> => {
  // An unattributed caller asserts nothing about ownership, so there is nothing
  // to check — and it must not require a catalog row either: automation actions
  // address keys that may have been written to the object store out of band.
  if (bucket === UNATTRIBUTED_BUCKET) return Effect.void
  return Effect.tryPromise({
    try: () => readFileMetadata(key),
    catch: (e: unknown) => makeError(e),
  }).pipe(
    Effect.flatMap((meta) =>
      meta && bucketBindingMatches(bucket, meta.bucket)
        ? Effect.void
        : Effect.fail(makeError(storageObjectNotFound(key)))
    )
  )
}

/**
 * Refuse a write that would move an existing object into the caller's bucket.
 *
 * This runs BEFORE the bytes are handed to the object store, and that ordering
 * is the whole point. S3 and local write the blob first and the catalog row
 * second, so a refusal raised only by the catalog upsert would arrive after the
 * victim's bytes had already been replaced — the object would survive with the
 * right owner and the wrong content, which is precisely the silent data loss
 * this gate exists to prevent. `byteaUpload` needs no pre-check because its
 * metadata upsert is upstream of its content upsert in the same call.
 *
 * The guarded upsert inside {@link writeFileMetadata} is still load-bearing: it
 * is what closes the window between this read and that write, and it is the
 * seam every provider funnels through.
 */
export const assertBucketWritable = (
  key: string,
  bucket: BucketBinding
): Effect.Effect<void, StorageError> =>
  Effect.tryPromise({
    try: () => readFileMetadata(key),
    catch: (e: unknown) => makeError(e),
  }).pipe(
    Effect.flatMap((meta) =>
      bucketBindingPermitsWrite(bucket, meta?.bucket)
        ? Effect.void
        : Effect.fail(makeError(storageObjectNotFound(key)))
    )
  )

/** File metadata lookup shared by every provider — reads `system.file_storage_metadata`. */
export const getMetadataFromCatalog: StorageService['Service']['getMetadata'] = (key, bucket) =>
  Effect.tryPromise({ try: () => readFileMetadata(key), catch: (e: unknown) => makeError(e) }).pipe(
    Effect.flatMap((meta) =>
      meta && bucketBindingMatches(bucket, meta.bucket)
        ? Effect.succeed({
            key,
            contentType: meta.contentType,
            size: meta.size,
            lastModified: meta.lastModified,
            ...(meta.bucket === null ? {} : { bucket: meta.bucket }),
            ...(meta.uploadedBy === null ? {} : { uploadedBy: meta.uploadedBy }),
            ...(meta.generatedBy === null ? {} : { generatedBy: meta.generatedBy }),
          })
        : Effect.fail(makeError(storageObjectNotFound(key)))
    )
  )

/** The provider's `findOtherSpelling`: the catalog row a write at a key would land on. */
export const findOtherSpellingIn =
  (store: Readonly<SpellingStore>) =>
  (key: string): Effect.Effect<Option.Option<StoredSpelling>, StorageError> =>
    Effect.tryPromise({
      try: () => findOtherStoredSpelling(key, store),
      catch: (e: unknown) => makeError(e),
    }).pipe(Effect.map(Option.fromNullishOr))

/**
 * Refuse a write whose key is a second spelling of a stored key, before any
 * byte is written. Keys are compared, never rewritten: the stored object keeps
 * its spelling and the new key is refused.
 *
 * The refusal mirrors what the stored key itself would answer. When the write
 * could not record the stored object's binding (another bucket's object), it is
 * the not-found every such write gets. Otherwise it is the second-spelling
 * refusal, which a route answers with a conflict.
 */
export const assertNoOtherSpelling = (
  key: string,
  bucket: BucketBinding,
  store: Readonly<SpellingStore>
): Effect.Effect<void, StorageError> =>
  findOtherSpellingIn(store)(key).pipe(
    Effect.map(Option.getOrUndefined),
    Effect.flatMap((other) => {
      if (other === undefined) return Effect.void
      return Effect.fail(
        makeError(
          bucketBindingPermitsWrite(bucket, other.bucket ?? null)
            ? storageKeySpellingTaken(key)
            : storageObjectNotFound(key)
        )
      )
    })
  )

/** One lock per comparison form a write is in flight for, with how many writes hold or wait on it. */
const spellingLocks = new Map<string, { readonly lock: Semaphore.Semaphore; holders: number }>()

/**
 * Run a write's spelling check and the write itself as one step against every
 * other write of a spelling of the same key in this process.
 *
 * {@link assertNoOtherSpelling} reads the catalog before the bytes are written,
 * and nothing in the catalog is unique by comparison form, so two NEW keys that
 * are spellings of each other (`Brief.txt`, `brief.txt`) uploaded at the same
 * moment would both find the other absent, both write the one file a folding
 * disk keeps for them, and leave two catalog rows naming it. Serialising them
 * makes the second one find the first's row. The lock is keyed by the folded
 * form whatever the store, which only ever serialises more; it is released when
 * the last writer of that form is done, so the map holds only writes in flight.
 * It covers one process, which is how the local provider is run.
 */
export const withSpellingLock =
  (key: string) =>
  <A, E, R>(write: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const form = storageKeyCollisionForm(key, { caseInsensitive: true })
    return Effect.acquireUseRelease(
      Effect.sync(() => {
        const entry = spellingLocks.get(form) ?? { lock: Semaphore.makeUnsafe(1), holders: 0 }
        entry.holders += 1
        spellingLocks.set(form, entry)
        return entry
      }),
      (entry) => entry.lock.withPermits(1)(write),
      (entry) =>
        Effect.sync(() => {
          entry.holders -= 1
          if (entry.holders === 0) spellingLocks.delete(form)
        })
    )
  }
