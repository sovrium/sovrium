/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reads of a stored file that never pass the size its catalogue row records.
 *
 * A file served or measured for a bucket has a catalogue row, and that row's
 * size is what was stored. The read is held to it: bytes on disk that outgrew
 * the row (written there out of band, or a row gone stale) fail the read at the
 * recorded size instead of being read whole. An unattributed read of a key the
 * catalogue does not hold is held to the size the object store reports and to
 * a fixed 100 MiB ceiling, so it too is read no further than one measured
 * length, and never past that ceiling.
 */

import { Effect } from 'effect'
import {
  isStorageObjectTooLarge,
  StorageService,
} from '@/application/ports/services/storage-service'
import { readRecordedIn, recordedSizeIn } from '@/application/ports/services/stored-file-read'
import type { BucketBinding, StorageError } from '@/application/ports/services/storage-service'

/**
 * The size recorded for `key` in `bucket`: its catalogue row's, or — for an
 * unattributed read of a key with no row — the size the object store reports.
 * Fails with the not-found marker when neither knows the key. A measure, not a
 * read: no ceiling applies here.
 */
export const recordedSizeOf = (
  key: string,
  bucket: BucketBinding
): Effect.Effect<number, StorageError, StorageService> =>
  Effect.gen(function* () {
    return yield* recordedSizeIn(yield* StorageService, key, bucket)
  }).pipe(Effect.withSpan('storage.recorded-size-of'))

/**
 * The bytes of the file at `key`, read no further than {@link recordedSizeOf},
 * and — for a key with no catalogue row — never past the fixed 100 MiB
 * ceiling: a file holding more fails with the
 * over-the-cap marker, and is never held in memory whole.
 */
export const readRecordedFile = (
  key: string,
  bucket: BucketBinding
): Effect.Effect<Uint8Array, StorageError, StorageService> =>
  Effect.gen(function* () {
    return yield* readRecordedIn(yield* StorageService, key, bucket)
  }).pipe(Effect.withSpan('storage.read-recorded-file'))

/**
 * Succeeds when a file is stored at `key` and `bucket` may read it, as a read
 * would answer, while reading at most its first piece: a read capped at zero
 * bytes either finds an empty file or stops at the first byte. Fails as the
 * read does otherwise — the not-found marker for a key nothing holds.
 */
export const probeStoredFile = (
  key: string,
  bucket: BucketBinding
): Effect.Effect<void, StorageError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.downloadBounded(key, bucket, 0).pipe(
      Effect.asVoid,
      Effect.catchIf(isStorageObjectTooLarge, () => Effect.void)
    )
  }).pipe(Effect.withSpan('storage.probe-stored-file'))
