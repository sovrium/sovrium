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
  storageObjectNotFound,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import { logWarning } from '@/infrastructure/logging/logger'
import { boundedDownload } from './bounded-read'
import { deleteFileMetadata, type CatalogWrite } from './bytea-adapter'
import { isClaimed, withoutClaimedKeys } from './catalog-claim'
import {
  assertBucketBinding,
  catalogBucketsOf,
  findOtherSpellingIn,
  getMetadataFromCatalog,
  withSpellingLock,
  type SpellingStore,
} from './catalog-guards'
import { createOnlyOutsideCatalog } from './create-only-write'
import {
  localDelete,
  localDeleteIfPresent,
  localDownloadWithin,
  localHashObject,
  localGetTotalBytes,
  localList,
  localListPage,
  localStageWrite,
  localStoredSize,
  localUpload,
  localUploadCreateOnly,
  localValidateDirectory,
} from './local-adapter'
import { probeLocalCaseOnce } from './local-case-probe'
import { sweepOrphanedStagingOnce } from './local-staging-sweep'
import { replaceOutsideCatalog } from './replacing-write'
import { attemptStorage, toStorageError } from './storage-attempt'
import { absentWhileClaimed, localObjectIdentity } from './stored-object-identity'
import { storedObjectSize } from './stored-object-size'
import type { BucketBinding } from '@/application/ports/services/storage-service'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * Remove the bytes of writes that never finished — staged files a stopped
 * process left beside their keys — as the provider starts. Housekeeping: a
 * directory that cannot be swept is logged and served all the same.
 */
const removeOrphanedStaging = (dir: string): Effect.Effect<void> =>
  attemptStorage(() => sweepOrphanedStagingOnce(dir)).pipe(
    Effect.tap((removed) =>
      removed.length === 0
        ? Effect.void
        : Effect.sync(() =>
            logWarning(
              `[storage] removed ${String(removed.length)} unfinished write(s) left in "${dir}"`
            )
          )
    ),
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logWarning(`[storage] could not remove unfinished writes in "${dir}": ${String(cause)}`)
      )
    ),
    // effect-swallow: removing staged bytes a stopped write left is housekeeping; a directory that cannot be swept still serves every stored file, and the failure is logged just above
    Effect.ignore,
    Effect.withSpan('storage.remove-orphaned-staging')
  )

/**
 * Make sure the local storage directory is writable, then measure whether its
 * disk ignores letter case — once per process ({@link probeLocalCaseOnce}).
 * A probe that cannot measure is reported and compares keys without case.
 */
const prepareLocalDirectory = (dir: string): Effect.Effect<SpellingStore, StorageError> =>
  Effect.tryPromise({
    try: () => localValidateDirectory(dir),
    catch: (e: unknown) =>
      new StorageError({ message: `Local storage directory "${dir}" is not accessible`, cause: e }),
  }).pipe(
    // effect-promise: total -- `probeLocalCaseOnce` turns a failed probe into a value.
    Effect.andThen(Effect.promise(() => probeLocalCaseOnce(dir))),
    Effect.tap((probed) =>
      probed.cause === undefined
        ? Effect.void
        : Effect.sync(() =>
            logWarning(
              `[storage] could not measure whether "${dir}" ignores letter case; keys are compared without case: ${String(probed.cause)}`
            )
          )
    ),
    Effect.map((probed): SpellingStore => ({
      caseInsensitive: probed.caseInsensitive,
      provider: 'local',
    })),
    Effect.tap(() => removeOrphanedStaging(dir)),
    Effect.withSpan('storage.prepare-local-directory')
  )

/** The local provider's `upload`: the file under `dir`, then the catalog row. */
const localStorageUpload =
  (
    client: PortableDb,
    dir: string,
    localStore: SpellingStore
  ): StorageService['Service']['upload'] =>
  (key, content, mimeType, target) => {
    const { bucket, uploadedById, generatedBy, mode } = uploadTargetParts(target)
    const recorded: CatalogWrite = {
      key,
      mimeType,
      size: content.length,
      storageProvider: 'local',
      bucket,
      uploadedById,
      generatedBy,
    }
    const write =
      mode === 'create-only'
        ? createOnlyOutsideCatalog({
            client,
            catalog: recorded,
            store: localStore,
            writeBytes: () => localUploadCreateOnly(dir, key, content),
          })
        : replaceOutsideCatalog({
            client,
            catalog: recorded,
            store: localStore,
            writeBytes: () => localUpload(dir, key, content),
            stageBytes: () => localStageWrite(dir, key, content),
          })
    return write.pipe(withSpellingLock(key))
  }

/** The local provider: bytes under `dir`, metadata in the catalog `client` holds. */
export const makeLocalStorage = (
  dir: string,
  client: PortableDb
): Effect.Effect<StorageService['Service'], StorageError> =>
  Effect.gen(function* () {
    const localStore = yield* prepareLocalDirectory(dir)
    return StorageService.of({
      upload: localStorageUpload(client, dir, localStore),
      downloadBounded: (key: string, bucket: BucketBinding, maxBytes: number) =>
        assertBucketBinding(client, key, bucket).pipe(
          Effect.andThen(
            boundedDownload(key, maxBytes, () => localDownloadWithin(dir, key, maxBytes))
          )
        ),
      delete: (key: string, bucket: BucketBinding) =>
        attemptStorage(() => deleteFileMetadata(client, key, bucket)).pipe(
          Effect.flatMap((found) =>
            found
              ? attemptStorage(() => localDelete(dir, key))
              : Effect.fail(toStorageError(storageObjectNotFound(key)))
          )
        ),
      deleteUncataloguedBytes: (key: string) =>
        attemptStorage(() => localDeleteIfPresent(dir, key)),
      getSignedUrl: (_key: string, _expiresIn: number) =>
        Effect.fail(new StorageError({ cause: 'Signed URLs not supported for local storage' })),
      getMetadata: getMetadataFromCatalog(client),
      findOtherSpelling: findOtherSpellingIn(client, localStore),
      statObject: (key: string) => storedObjectSize(key, () => localStoredSize(dir, key)),
      objectIdentity: (key: string) =>
        absentWhileClaimed(
          key,
          () => localObjectIdentity(dir, key),
          (claimedKey) => isClaimed(client, claimedKey)
        ),
      hashObject: (key: string) => attemptStorage(() => localHashObject(dir, key)),
      list: (prefix: string) =>
        attemptStorage(() =>
          localList(dir, prefix).then((keys) => withoutClaimedKeys(client, keys))
        ),
      listPage: (input) =>
        attemptStorage(async () => {
          const page = await localListPage(dir, input)
          return { ...page, keys: await withoutClaimedKeys(client, page.keys) }
        }),
      catalogBuckets: catalogBucketsOf(client),
      getTotalBytes: attemptStorage(() => localGetTotalBytes(dir)),
    })
  }).pipe(Effect.withSpan('storage.make-local-storage'))
