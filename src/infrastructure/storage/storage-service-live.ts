/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  StorageService,
  StorageError,
  storageObjectNotFound,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import {
  parseStorageEnvConfig,
  validateStorageSizeLimits,
} from '@/domain/models/process-env/storage/storage'
import { logWarning } from '@/infrastructure/logging/logger'
import {
  byteaUpload,
  byteaDownload,
  byteaDelete,
  byteaList,
  byteaGetTotalBytes,
  byteaStoredSize,
  byteaValidateAndInit,
  deleteFileMetadata,
  writeFileMetadata,
} from './bytea-adapter'
import {
  assertBucketBinding,
  assertBucketWritable,
  assertNoOtherSpelling,
  findOtherSpellingIn,
  withSpellingLock,
  getMetadataFromCatalog,
  type SpellingStore,
} from './catalog-guards'
import {
  localUpload,
  localDownload,
  localDelete,
  localDeleteIfPresent,
  localList,
  localGetTotalBytes,
  localStoredSize,
  localValidateDirectory,
} from './local-adapter'
import { probeLocalCaseOnce } from './local-case-probe'
import {
  createS3Client,
  s3Upload,
  s3Download,
  s3Delete,
  s3List,
  s3GetSignedUrl,
  s3GetTotalBytes,
} from './s3-adapter'
import { findMissingS3EnvVar, warnIfS3BucketUnreachable } from './s3-reachability'
import { s3StoredSize, storedObjectSize } from './stored-object-size'
import type { BucketBinding, UploadTarget } from '@/application/ports/services/storage-service'

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

/**
 * Unwrap an S3 listing result, warning when the walk was truncated.
 *
 * The `StorageService` port answers `readonly string[]` / `number`, and
 * widening it to carry a truncation flag would ripple through every quota and
 * dashboard caller for a condition that needs 100 000 objects in one bucket to
 * arise. But dropping the flag silently is what the pre-pagination adapter
 * already did, and the whole point of following `ContinuationToken` was to
 * stop under-reporting without saying so. A warning keeps the port stable
 * while leaving the operator a record that the figure is a lower bound.
 */
const unwrapS3Listing = <A>(value: A, truncated: boolean, operation: string, bucket: string): A => {
  if (truncated) {
    logWarning(
      `[storage] s3 ${operation} truncated at the page ceiling for bucket "${bucket}" — the reported value is a lower bound, not the bucket total`
    )
  }
  return value
}

/** An object store keeps letter case; normalisation is compared on every store. */
const S3_STORE: SpellingStore = { caseInsensitive: false, provider: 's3' }

/** A database key: compared with case, and normalised like every other key. */
const BYTEA_STORE: SpellingStore = { caseInsensitive: false, provider: 'bytea' }

/**
 * Make sure the local storage directory is writable, then measure whether its
 * disk ignores letter case — once per process ({@link probeLocalCaseOnce}).
 * A probe that cannot measure is reported and compares keys without case.
 */
const prepareLocalDirectory = (dir: string): Effect.Effect<SpellingStore, StorageError> =>
  Effect.tryPromise({
    try: () => localValidateDirectory(dir),
    catch: (e: unknown) =>
      new StorageError({ cause: `Local storage directory "${dir}" is not accessible: ${e}` }),
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
    Effect.withSpan('storage.prepare-local-directory')
  )

export const StorageServiceLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    // Validate operator-controlled storage size-limit env vars at startup so
    // misconfigured STORAGE_MAX_FILE_SIZE / STORAGE_MAX_TOTAL_SIZE values fail
    // the boot with a descriptive error rather than being silently ignored.
    validateStorageSizeLimits()
    const missingS3Var = findMissingS3EnvVar()
    if (missingS3Var) {
      // Thrown synchronously so error.message surfaces with the canonical env-var name
      // (matches the existing pattern of Schema.decodeUnknownSync in parseStorageEnvConfig).
      // Effect.fail with a tagged error would lose the message at the top-level catch.
      throw new Error(`Required env var ${missingS3Var} is missing`)
    }
    const config = parseStorageEnvConfig()

    if (config?.provider === 's3') {
      const client = createS3Client(config)
      const { bucket: s3Bucket } = config
      // ADVISORY, not fatal, and at most once per process — see
      // {@link warnIfS3BucketUnreachable} and ./s3-bucket-probe.
      // effect-promise: total -- `warnIfS3BucketUnreachable` only awaits `probeS3BucketOnce`, which converts every rejection into a value; neither has a failure mode.
      yield* Effect.promise(() => warnIfS3BucketUnreachable(client, config.endpoint, s3Bucket))
      return StorageService.of({
        upload: (key: string, content: Uint8Array, mimeType: string, target: UploadTarget) => {
          const { bucket, uploadedById, generatedBy } = uploadTargetParts(target)
          return assertBucketWritable(key, bucket).pipe(
            Effect.andThen(assertNoOtherSpelling(key, bucket, S3_STORE)),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  s3Upload({ client, bucket: s3Bucket, key, content, mimeType }).then(() =>
                    writeFileMetadata({
                      key,
                      mimeType,
                      size: content.length,
                      storageProvider: 's3',
                      bucket,
                      uploadedById,
                      generatedBy,
                    })
                  ),
                catch: (e: unknown) => makeError(e),
              })
            ),
            withSpellingLock(key)
          )
        },
        download: (key: string, bucket: BucketBinding) =>
          assertBucketBinding(key, bucket).pipe(
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () => s3Download(client, s3Bucket, key),
                catch: (e: unknown) => makeError(e),
              })
            )
          ),
        delete: (key: string, bucket: BucketBinding) =>
          Effect.tryPromise({
            try: () => deleteFileMetadata(key, bucket),
            catch: (e: unknown) => makeError(e),
          }).pipe(
            Effect.flatMap((found) =>
              found
                ? Effect.tryPromise({
                    try: () => s3Delete(client, s3Bucket, key),
                    catch: (e: unknown) => makeError(e),
                  })
                : Effect.fail(makeError(storageObjectNotFound(key)))
            )
          ),
        deleteUncataloguedBytes: (key: string) =>
          Effect.tryPromise({
            try: () => s3Delete(client, s3Bucket, key),
            catch: (e: unknown) => makeError(e),
          }),
        getSignedUrl: (key: string, expiresIn: number) =>
          Effect.tryPromise({
            try: () => s3GetSignedUrl(client, s3Bucket, key, expiresIn),
            catch: (e: unknown) => makeError(e),
          }),
        getMetadata: getMetadataFromCatalog,
        findOtherSpelling: findOtherSpellingIn(S3_STORE),
        statObject: (key: string) =>
          storedObjectSize(key, () => s3StoredSize(client, s3Bucket, key)),
        list: (prefix: string) =>
          Effect.tryPromise({
            try: () => s3List(client, s3Bucket, prefix),
            catch: (e: unknown) => makeError(e),
          }).pipe(
            Effect.map((page) => unwrapS3Listing(page.keys, page.truncated, 'list', s3Bucket))
          ),
        getTotalBytes: Effect.tryPromise({
          try: () => s3GetTotalBytes(client, s3Bucket),
          catch: (e: unknown) => makeError(e),
        }).pipe(
          Effect.map((total) =>
            unwrapS3Listing(total.bytes, total.truncated, 'getTotalBytes', s3Bucket)
          )
        ),
      })
    }

    if (config?.provider === 'local') {
      const dir = config.directory
      const localStore = yield* prepareLocalDirectory(dir)
      return StorageService.of({
        upload: (key: string, content: Uint8Array, mimeType: string, target: UploadTarget) => {
          const { bucket, uploadedById, generatedBy } = uploadTargetParts(target)
          return assertBucketWritable(key, bucket).pipe(
            Effect.andThen(assertNoOtherSpelling(key, bucket, localStore)),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () =>
                  localUpload(dir, key, content).then(() =>
                    writeFileMetadata({
                      key,
                      mimeType,
                      size: content.length,
                      storageProvider: 'local',
                      bucket,
                      uploadedById,
                      generatedBy,
                    })
                  ),
                catch: (e: unknown) => makeError(e),
              })
            ),
            withSpellingLock(key)
          )
        },
        download: (key: string, bucket: BucketBinding) =>
          assertBucketBinding(key, bucket).pipe(
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: () => localDownload(dir, key),
                catch: (e: unknown) => makeError(e),
              })
            )
          ),
        delete: (key: string, bucket: BucketBinding) =>
          Effect.tryPromise({
            try: () => deleteFileMetadata(key, bucket),
            catch: (e: unknown) => makeError(e),
          }).pipe(
            Effect.flatMap((found) =>
              found
                ? Effect.tryPromise({
                    try: () => localDelete(dir, key),
                    catch: (e: unknown) => makeError(e),
                  })
                : Effect.fail(makeError(storageObjectNotFound(key)))
            )
          ),
        deleteUncataloguedBytes: (key: string) =>
          Effect.tryPromise({
            try: () => localDeleteIfPresent(dir, key),
            catch: (e: unknown) => makeError(e),
          }),
        getSignedUrl: (_key: string, _expiresIn: number) =>
          Effect.fail(new StorageError({ cause: 'Signed URLs not supported for local storage' })),
        getMetadata: getMetadataFromCatalog,
        findOtherSpelling: findOtherSpellingIn(localStore),
        statObject: (key: string) => storedObjectSize(key, () => localStoredSize(dir, key)),
        list: (prefix: string) =>
          Effect.tryPromise({
            try: () => localList(dir, prefix),
            catch: (e: unknown) => makeError(e),
          }),
        getTotalBytes: Effect.tryPromise({
          try: () => localGetTotalBytes(dir),
          catch: (e: unknown) => makeError(e),
        }),
      })
    }

    // No storage config resolved. `parseStorageEnvConfig()` already applies the
    // dialect-aware defaults: PostgreSQL with no STORAGE_PROVIDER → bytea;
    // SQLite (zero-config) with no STORAGE_PROVIDER → local filesystem. It only
    // returns `undefined` when storage is genuinely disabled (no database and
    // no STORAGE_PROVIDER) — so this stub branch is now the true "disabled"
    // case. The matching startup warning
    //   "Storage: Not configured (attachment fields will be disabled)"
    // is emitted by collectStoragePhases() in
    // src/infrastructure/server/startup-degradation-phases.ts (this layer is
    // constructed lazily per request, so it can't emit the warning itself).
    if (!config) {
      const notConfigured = (): StorageError =>
        new StorageError({
          cause:
            'No storage provider configured. Set STORAGE_PROVIDER=s3|local or DATABASE_URL to enable file storage.',
        })
      return StorageService.of({
        upload: (_key: string, _content: Uint8Array, _mimeType: string, _target: UploadTarget) =>
          Effect.fail(notConfigured()),
        download: (_key: string, _bucket: BucketBinding) => Effect.fail(notConfigured()),
        delete: (_key: string, _bucket: BucketBinding) => Effect.fail(notConfigured()),
        deleteUncataloguedBytes: (_key: string) => Effect.fail(notConfigured()),
        getSignedUrl: (_key: string, _expiresIn: number) => Effect.fail(notConfigured()),
        getMetadata: (_key: string, _bucket: BucketBinding) => Effect.fail(notConfigured()),
        findOtherSpelling: (_key: string) => Effect.fail(notConfigured()),
        statObject: (_key: string) => Effect.fail(notConfigured()),
        list: (_prefix: string) => Effect.fail(notConfigured()),
        getTotalBytes: Effect.succeed(0),
      })
    }

    // Auto-fallback: bytea (DATABASE_URL is set).
    // Validate the database connection at startup so unreachable-DB failures
    // surface immediately instead of on the first upload. The
    // system.file_storage_bytea / system.file_storage_metadata tables are
    // created by Drizzle migrations (run by serverFactory.create after this
    // validation), so the bytea adapter only checks connectivity here.
    yield* Effect.tryPromise({
      try: () => byteaValidateAndInit(),
      catch: (e: unknown) =>
        new StorageError({
          cause: `Bytea storage initialization failed (DATABASE_URL): ${e}`,
        }),
    })

    return StorageService.of({
      upload: (key: string, content: Uint8Array, mimeType: string, target: UploadTarget) =>
        assertNoOtherSpelling(key, uploadTargetParts(target).bucket, BYTEA_STORE).pipe(
          Effect.andThen(
            Effect.tryPromise({
              try: () => byteaUpload(key, content, mimeType, target),
              catch: (e: unknown) => makeError(e),
            })
          ),
          withSpellingLock(key)
        ),
      download: (key: string, bucket: BucketBinding) =>
        Effect.tryPromise({
          try: () => byteaDownload(key, bucket),
          catch: (e: unknown) => makeError(e),
        }),
      delete: (key: string, bucket: BucketBinding) =>
        Effect.tryPromise({
          try: () => byteaDelete(key, bucket),
          catch: (e: unknown) => makeError(e),
        }),
      // The payload is a row cascading off the catalog row, so deleting that row
      // already removed the bytes: nothing is left to delete.
      deleteUncataloguedBytes: (_key: string) => Effect.void,
      getSignedUrl: (_key: string, _expiresIn: number) =>
        Effect.fail(new StorageError({ cause: 'Signed URLs not supported for bytea storage' })),
      getMetadata: getMetadataFromCatalog,
      findOtherSpelling: findOtherSpellingIn(BYTEA_STORE),
      statObject: (key: string) => storedObjectSize(key, () => byteaStoredSize(key)),
      list: (prefix: string) =>
        Effect.tryPromise({
          try: () => byteaList(prefix),
          catch: (e: unknown) => makeError(e),
        }),
      getTotalBytes: Effect.tryPromise({
        try: () => byteaGetTotalBytes(),
        catch: (e: unknown) => makeError(e),
      }),
    })
  })
)
