/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  StorageService,
  StorageError,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import {
  byteaDelete,
  byteaDownload,
  byteaGetTotalBytes,
  byteaStoredSize,
  byteaValidateAndInit,
} from './bytea-adapter'
import { byteaUploadCreateOnly } from './bytea-create-only'
import { BYTEA_LIST_PAGE, byteaList, byteaListPage } from './bytea-list'
import { byteaUpload } from './bytea-upload'
import {
  assertNoOtherSpelling,
  catalogBucketsOf,
  findOtherSpellingIn,
  getMetadataFromCatalog,
  withSpellingLock,
  type SpellingStore,
} from './catalog-guards'
import { createOnlyInCatalog } from './create-only-write'
import { byteaObjectIdentity, storedObjectIdentity } from './stored-object-identity'
import { storedObjectSize } from './stored-object-size'
import type { BucketBinding } from '@/application/ports/services/storage-service'

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, StorageError> =>
  Effect.tryPromise({ try: run, catch: (e: unknown) => makeError(e) })

/** A database key: compared with case, and normalised like every other key. */
const BYTEA_STORE: SpellingStore = { caseInsensitive: false, provider: 'bytea' }

/** The database provider's `upload`: the catalog row and its payload. */
const byteaStorageUpload: StorageService['Service']['upload'] = (
  key,
  content,
  mimeType,
  target
) => {
  const { bucket, mode } = uploadTargetParts(target)
  const write =
    mode === 'create-only'
      ? createOnlyInCatalog({
          key,
          bucket,
          store: BYTEA_STORE,
          insert: () => byteaUploadCreateOnly(key, content, mimeType, target),
        })
      : assertNoOtherSpelling(key, bucket, BYTEA_STORE).pipe(
          Effect.andThen(attempt(() => byteaUpload(key, content, mimeType, target)))
        )
  return write.pipe(withSpellingLock(key))
}

/**
 * The database provider (DATABASE_URL set, no STORAGE_PROVIDER): bytes and
 * metadata both in the database.
 *
 * The connection is validated at startup so an unreachable database surfaces
 * immediately instead of on the first upload. The `system.file_storage_bytea`
 * / `system.file_storage_metadata` tables are created by Drizzle migrations
 * (run by serverFactory.create after this validation), so the adapter only
 * checks connectivity here.
 */
export const makeByteaStorage: Effect.Effect<StorageService['Service'], StorageError> = Effect.gen(
  function* () {
    yield* Effect.tryPromise({
      try: () => byteaValidateAndInit(),
      catch: (e: unknown) =>
        new StorageError({ cause: `Bytea storage initialization failed (DATABASE_URL): ${e}` }),
    })
    return StorageService.of({
      upload: byteaStorageUpload,
      download: (key: string, bucket: BucketBinding) => attempt(() => byteaDownload(key, bucket)),
      delete: (key: string, bucket: BucketBinding) => attempt(() => byteaDelete(key, bucket)),
      // The payload is a row cascading off the catalog row, so deleting that row
      // already removed the bytes: nothing is left to delete.
      deleteUncataloguedBytes: (_key: string) => Effect.void,
      getSignedUrl: (_key: string, _expiresIn: number) =>
        Effect.fail(new StorageError({ cause: 'Signed URLs not supported for bytea storage' })),
      getMetadata: getMetadataFromCatalog,
      findOtherSpelling: findOtherSpellingIn(BYTEA_STORE),
      statObject: (key: string) => storedObjectSize(key, () => byteaStoredSize(key)),
      objectIdentity: (key: string) => storedObjectIdentity(() => byteaObjectIdentity(key)),
      list: (prefix: string) => attempt(() => byteaList(prefix)),
      listPage: ({ prefix, after, size }) => {
        const pageSize = Math.min(size, BYTEA_LIST_PAGE)
        return attempt(() => byteaListPage(prefix, after, pageSize)).pipe(
          Effect.map((keys) => ({ keys, after: keys.length < pageSize ? undefined : keys.at(-1) }))
        )
      },
      catalogBuckets: catalogBucketsOf,
      getTotalBytes: attempt(() => byteaGetTotalBytes()),
    })
  }
).pipe(Effect.withSpan('storage.make-bytea-storage'))
