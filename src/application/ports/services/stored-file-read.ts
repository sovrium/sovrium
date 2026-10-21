/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reads of a stored file held to the size recorded for it, written against the
 * {@link StorageService} port itself so every reader — a use-case or an adapter
 * handed the service at layer composition — reads one way.
 *
 * A file with a catalogue row is read no further than the size that row
 * records. An unattributed read of a key the catalogue does not hold is held to
 * the size the object store reports, and never past a fixed ceiling.
 */

import { Effect } from 'effect'
import {
  FILE_SOURCE_MAX_BYTES,
  isStorageObjectNotFound,
  StorageError,
  storageObjectTooLarge,
  UNATTRIBUTED_BUCKET,
} from './storage-service'
import type { BucketBinding, StorageService } from './storage-service'

/**
 * The size recorded for `key` in `bucket`: its catalogue row's, or — for an
 * unattributed read of a key with no row — the size the object store reports,
 * refused with the over-the-cap marker past `ceiling`. Fails with the
 * not-found marker when neither knows the key.
 */
export const recordedSizeIn = (
  storage: StorageService['Service'],
  key: string,
  bucket: BucketBinding,
  ceiling: number = Number.POSITIVE_INFINITY
): Effect.Effect<number, StorageError> =>
  storage.getMetadata(key, bucket).pipe(
    Effect.map((meta) => meta.size),
    Effect.catchIf(
      (error) => bucket === UNATTRIBUTED_BUCKET && isStorageObjectNotFound(error),
      () =>
        Effect.flatMap(storage.statObject(key), (stat) =>
          stat.size > ceiling
            ? Effect.fail(new StorageError({ cause: storageObjectTooLarge(key, ceiling) }))
            : Effect.succeed(stat.size)
        )
    )
  )

/**
 * The bytes of the file at `key`, read no further than {@link recordedSizeIn}
 * with {@link FILE_SOURCE_MAX_BYTES} as the ceiling for a key with no row: a
 * file holding more fails with the over-the-cap marker, and is never held in
 * memory whole.
 */
export const readRecordedIn = (
  storage: StorageService['Service'],
  key: string,
  bucket: BucketBinding
): Effect.Effect<Uint8Array, StorageError> =>
  Effect.flatMap(recordedSizeIn(storage, key, bucket, FILE_SOURCE_MAX_BYTES), (size) =>
    storage.downloadBounded(key, bucket, size)
  )
