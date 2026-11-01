/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import {
  StorageService,
  StorageError,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { getPgDb } from '@/infrastructure/database/drizzle/portable-db'
import { boundedDownload } from './bounded-read'
import {
  byteaDelete,
  byteaDownloadWithin,
  byteaGetTotalBytes,
  byteaStoredSize,
  byteaValidateAndInit,
} from './bytea-adapter'
import { byteaUploadCreateOnlyIn } from './bytea-create-only'
import { BYTEA_LIST_PAGE, byteaList, byteaListPage } from './bytea-list'
import { byteaUploadIn } from './bytea-upload'
import {
  assertNoOtherSpelling,
  catalogBucketsOf,
  findOtherSpellingIn,
  getMetadataFromCatalog,
  withSpellingLock,
  type SpellingStore,
} from './catalog-guards'
import { createOnlyInCatalog } from './create-only-write'
import { attemptStorage } from './storage-attempt'
import {
  byteaHashObject,
  byteaObjectIdentity,
  storedObjectIdentity,
} from './stored-object-identity'
import { storedObjectSize } from './stored-object-size'
import type { BucketBinding } from '@/application/ports/services/storage-service'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/** A database key: compared with case, and normalised like every other key. */
const BYTEA_STORE: SpellingStore = { caseInsensitive: false, provider: 'bytea' }

/** The database provider's `upload`: the catalog row and its payload. */
const byteaStorageUpload =
  (client: PortableDb): StorageService['Service']['upload'] =>
  (key, content, mimeType, target) => {
    const { bucket, mode } = uploadTargetParts(target)
    const write =
      mode === 'create-only'
        ? createOnlyInCatalog({
            client,
            key,
            bucket,
            store: BYTEA_STORE,
            insert: byteaUploadCreateOnlyIn(client)(key, content, mimeType, target),
          })
        : assertNoOtherSpelling(client, key, bucket, BYTEA_STORE).pipe(
            Effect.andThen(
              attemptStorage(() => byteaUploadIn(client)(key, content, mimeType, target))
            )
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
export const makeByteaStorage = (
  database: DatabaseService
): Effect.Effect<StorageService['Service'], StorageError> =>
  Effect.gen(function* () {
    const client = getPgDb(database)
    const config = parseDatabaseDialectConfig(yield* ProcessEnv)
    const databaseUrl = config.dialect === 'postgres' ? config.databaseUrl : ''
    yield* Effect.tryPromise({
      try: () => byteaValidateAndInit(client, databaseUrl),
      catch: (e: unknown) =>
        new StorageError({
          message: 'Bytea storage initialization failed (DATABASE_URL)',
          cause: e,
        }),
    })
    return StorageService.of({
      upload: byteaStorageUpload(client),
      downloadBounded: (key: string, bucket: BucketBinding, maxBytes: number) =>
        boundedDownload(key, maxBytes, () => byteaDownloadWithin(client, key, bucket, maxBytes)),
      delete: (key: string, bucket: BucketBinding) =>
        attemptStorage(() => byteaDelete(client, key, bucket)),
      // The payload is a row cascading off the catalog row, so deleting that row
      // already removed the bytes: nothing is left to delete.
      deleteUncataloguedBytes: (_key: string) => Effect.void,
      getSignedUrl: (_key: string, _expiresIn: number) =>
        Effect.fail(new StorageError({ cause: 'Signed URLs not supported for bytea storage' })),
      getMetadata: getMetadataFromCatalog(client),
      findOtherSpelling: findOtherSpellingIn(client, BYTEA_STORE),
      statObject: (key: string) => storedObjectSize(key, () => byteaStoredSize(client, key)),
      objectIdentity: (key: string) => storedObjectIdentity(() => byteaObjectIdentity(client, key)),
      hashObject: (key: string) => attemptStorage(() => byteaHashObject(client, key)),
      list: (prefix: string) => attemptStorage(() => byteaList(client, prefix)),
      listPage: ({ prefix, after, size }) => {
        const pageSize = Math.min(size, BYTEA_LIST_PAGE)
        return attemptStorage(() => byteaListPage(client, prefix, after, pageSize)).pipe(
          Effect.map((keys) => ({ keys, after: keys.length < pageSize ? undefined : keys.at(-1) }))
        )
      },
      catalogBuckets: catalogBucketsOf(client),
      getTotalBytes: attemptStorage(() => byteaGetTotalBytes(client)),
    })
  }).pipe(Effect.withSpan('storage.make-bytea-storage'))
