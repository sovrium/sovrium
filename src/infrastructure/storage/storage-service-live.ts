/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- Effect Layer service object is mutated during construction by library design */

import { Effect, Layer } from 'effect'
import {
  StorageService,
  StorageError,
  UNATTRIBUTED_BUCKET,
} from '@/application/ports/services/storage-service'
import {
  parseStorageEnvConfig,
  validateStorageSizeLimits,
} from '@/domain/models/process-env/storage/storage'
import { logWarning } from '@/infrastructure/logging/logger'
import {
  bucketBindingMatches,
  bucketBindingPermitsWrite,
  byteaUpload,
  byteaDownload,
  byteaDelete,
  byteaList,
  byteaGetTotalBytes,
  byteaValidateAndInit,
  deleteFileMetadata,
  readFileMetadata,
  writeFileMetadata,
} from './bytea-adapter'
import {
  localUpload,
  localDownload,
  localDelete,
  localList,
  localGetTotalBytes,
  localValidateDirectory,
} from './local-adapter'
import {
  createS3Client,
  s3Upload,
  s3Download,
  s3Delete,
  s3List,
  s3GetSignedUrl,
  s3GetSignedUploadUrl,
  s3GetTotalBytes,
  s3ValidateBucket,
} from './s3-adapter'
import { probeS3BucketOnce } from './s3-bucket-probe'
import type { BucketBinding } from '@/application/ports/services/storage-service'

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

/**
 * Refuse an operation whose caller named a bucket the object does not belong
 * to — or that belongs to no recorded bucket at all.
 *
 * Storage keys are FLAT, so without this every declared bucket addresses the
 * same objects and the bucket in the URL only chooses which permission block
 * runs. The failure is shaped as "File not found" so the route answers 404,
 * never distinguishing "wrong bucket" from "absent" to a caller.
 */
const assertBucketBinding = (
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
        : Effect.fail(makeError(new Error(`File not found: ${key}`)))
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
const assertBucketWritable = (
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
        : Effect.fail(makeError(new Error(`File not found: ${key}`)))
    )
  )

/** File metadata lookup shared by every provider — reads `system.file_storage_metadata`. */
const getMetadataFromCatalog = (
  key: string,
  bucket: BucketBinding
): Effect.Effect<
  {
    readonly key: string
    readonly contentType: string
    readonly size: number
    readonly lastModified: string
  },
  StorageError
> =>
  Effect.tryPromise({ try: () => readFileMetadata(key), catch: (e: unknown) => makeError(e) }).pipe(
    Effect.flatMap((meta) =>
      meta && bucketBindingMatches(bucket, meta.bucket)
        ? Effect.succeed({
            key,
            contentType: meta.contentType,
            size: meta.size,
            lastModified: meta.lastModified,
          })
        : Effect.fail(makeError(new Error(`File not found: ${key}`)))
    )
  )

const signedUploadUrlUnsupported = (provider: string): Effect.Effect<string, StorageError> =>
  Effect.fail(
    new StorageError({ cause: `Signed upload URLs not supported for ${provider} storage` })
  )

/**
 * Find the first missing required S3 environment variable when
 * STORAGE_PROVIDER=s3. Returns the env-var name (e.g. "STORAGE_S3_BUCKET") so
 * startup errors surface with the name the operator actually wrote, instead of
 * a generic Effect Schema decode error reporting the schema-key name (e.g.
 * "bucket") — which names nothing an operator can grep their deployment for.
 *
 * Runs only when the operator has set at least one of the four, so an
 * unconfigured install still reaches `parseStorageEnvConfig` and gets the
 * schema's own message rather than a guess about which var came first.
 */
const findMissingS3EnvVar = (): string | undefined => {
  if (process.env.STORAGE_PROVIDER !== 's3') return undefined
  const requiredS3Vars: ReadonlyArray<string> = [
    'STORAGE_S3_BUCKET',
    'STORAGE_S3_ENDPOINT',
    'STORAGE_S3_ACCESS_KEY_ID',
    'STORAGE_S3_SECRET_ACCESS_KEY',
  ]
  const anySet = requiredS3Vars.some((name) => process.env[name] !== undefined)
  if (!anySet) return undefined
  return requiredS3Vars.find((name) => !process.env[name])
}

/**
 * Take the advisory S3 bucket probe and warn when it did not answer.
 *
 * This used to be an `Effect.tryPromise` inside the layer body whose failure
 * ABORTED construction, which had two costs. A bucket that was briefly
 * unreachable took down every composition holding this layer — including ones
 * serving routes that never touch storage — and, because the failure then had
 * to be erased somewhere, both composition roots wrapped the layer in
 * `Layer.orDie`. And since `routes/buckets/effect-runner.ts` re-provides the
 * layer per request, the check cost an S3 `LIST` on every signed-URL request.
 *
 * Now: at most one `LIST` per process per endpoint, and a warning instead of a
 * failure. The operator still learns about it at boot; a request against a
 * genuinely broken backend still fails with the `StorageError` the operation
 * itself raises, which is the error that can actually be acted on.
 *
 * Never rejects — `probeS3BucketOnce` resolves its failures as values — so the
 * caller's `Effect.promise` cannot become a defect.
 */
const warnIfS3BucketUnreachable = async (
  client: Bun.S3Client,
  endpoint: string,
  bucket: string
): Promise<void> => {
  const probe = await probeS3BucketOnce(`${endpoint}|${bucket}`, () =>
    s3ValidateBucket(client, bucket)
  )
  if (probe.reachable) return
  logWarning(
    `[storage] S3 bucket "${bucket}" did not answer a reachability probe: ${String(probe.cause)}. Storage operations will surface their own errors.`
  )
}

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
      // eslint-disable-next-line functional/no-throw-statements -- see comment above
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
        upload: (key: string, content: Uint8Array, mimeType: string, bucket: BucketBinding) =>
          assertBucketWritable(key, bucket).pipe(
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
                    })
                  ),
                catch: (e: unknown) => makeError(e),
              })
            )
          ),
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
                : Effect.fail(makeError(new Error(`File not found: ${key}`)))
            )
          ),
        getSignedUrl: (key: string, expiresIn: number) =>
          Effect.tryPromise({
            try: () => s3GetSignedUrl(client, s3Bucket, key, expiresIn),
            catch: (e: unknown) => makeError(e),
          }),
        getSignedUploadUrl: (key: string, expiresIn: number, contentType?: string) =>
          Effect.tryPromise({
            try: () =>
              s3GetSignedUploadUrl({ client, bucket: s3Bucket, key, expiresIn, contentType }),
            catch: (e: unknown) => makeError(e),
          }),
        getMetadata: getMetadataFromCatalog,
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
      yield* Effect.tryPromise({
        try: () => localValidateDirectory(dir),
        catch: (e: unknown) =>
          new StorageError({ cause: `Local storage directory "${dir}" is not accessible: ${e}` }),
      })
      return StorageService.of({
        upload: (key: string, content: Uint8Array, mimeType: string, bucket: BucketBinding) =>
          assertBucketWritable(key, bucket).pipe(
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
                    })
                  ),
                catch: (e: unknown) => makeError(e),
              })
            )
          ),
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
                : Effect.fail(makeError(new Error(`File not found: ${key}`)))
            )
          ),
        getSignedUrl: (_key: string, _expiresIn: number) =>
          Effect.fail(new StorageError({ cause: 'Signed URLs not supported for local storage' })),
        getSignedUploadUrl: (_key: string, _expiresIn: number, _contentType?: string) =>
          signedUploadUrlUnsupported('local'),
        getMetadata: getMetadataFromCatalog,
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
        upload: (_key: string, _content: Uint8Array, _mimeType: string, _bucket: BucketBinding) =>
          Effect.fail(notConfigured()),
        download: (_key: string, _bucket: BucketBinding) => Effect.fail(notConfigured()),
        delete: (_key: string, _bucket: BucketBinding) => Effect.fail(notConfigured()),
        getSignedUrl: (_key: string, _expiresIn: number) => Effect.fail(notConfigured()),
        getSignedUploadUrl: (_key: string, _expiresIn: number, _contentType?: string) =>
          Effect.fail(notConfigured()),
        getMetadata: (_key: string, _bucket: BucketBinding) => Effect.fail(notConfigured()),
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
      upload: (key: string, content: Uint8Array, mimeType: string, bucket: BucketBinding) =>
        Effect.tryPromise({
          try: () => byteaUpload(key, content, mimeType, bucket),
          catch: (e: unknown) => makeError(e),
        }),
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
      getSignedUrl: (_key: string, _expiresIn: number) =>
        Effect.fail(new StorageError({ cause: 'Signed URLs not supported for bytea storage' })),
      getSignedUploadUrl: (_key: string, _expiresIn: number, _contentType?: string) =>
        signedUploadUrlUnsupported('bytea'),
      getMetadata: getMetadataFromCatalog,
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
