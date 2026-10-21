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
import { withoutClaimedKeys } from './catalog-claim'
import {
  assertBucketBinding,
  catalogBucketsOf,
  findOtherSpellingIn,
  getMetadataFromCatalog,
  withSpellingLock,
  type SpellingStore,
} from './catalog-guards'
import { createOnlyOutsideCatalog } from './create-only-write'
import { replaceOutsideCatalog } from './replacing-write'
import {
  createS3Client,
  s3Delete,
  s3GetSignedUrl,
  s3GetTotalBytes,
  s3List,
  s3ListPage,
  s3Upload,
  s3UploadCreateOnly,
} from './s3-adapter'
import { s3DownloadWithin, s3HashObject } from './s3-bounded-download'
import { warnIfS3BucketUnreachable } from './s3-reachability'
import {
  absentWhileClaimed,
  s3ObjectIdentity,
  storedObjectIdentity,
} from './stored-object-identity'
import { s3StoredSize, storedObjectSize } from './stored-object-size'
import type { BucketBinding } from '@/application/ports/services/storage-service'
import type { S3StorageEnvConfig } from '@/domain/models/process-env/storage/storage'

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

const attempt = <A>(run: () => Promise<A>): Effect.Effect<A, StorageError> =>
  Effect.tryPromise({ try: run, catch: (e: unknown) => makeError(e) })

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

/** The S3 provider's `upload`: bytes in `s3Bucket`, then the catalog row. */
const s3StorageUpload =
  (client: Bun.S3Client, s3Bucket: string): StorageService['Service']['upload'] =>
  (key, content, mimeType, target) => {
    const { bucket, uploadedById, generatedBy, mode } = uploadTargetParts(target)
    const recorded: CatalogWrite = {
      key,
      mimeType,
      size: content.length,
      storageProvider: 's3',
      bucket,
      uploadedById,
      generatedBy,
    }
    const params = { client, bucket: s3Bucket, key, content, mimeType }
    const write =
      mode === 'create-only'
        ? createOnlyOutsideCatalog({
            catalog: recorded,
            store: S3_STORE,
            writeBytes: () => s3UploadCreateOnly(params),
          })
        : replaceOutsideCatalog({
            catalog: recorded,
            store: S3_STORE,
            writeBytes: () => s3Upload(params),
          })
    return write.pipe(withSpellingLock(key))
  }

/** The S3 provider's read of an object's bytes, bounded, checking the binding. */
const s3Reads = (
  client: Bun.S3Client,
  s3Bucket: string
): Pick<StorageService['Service'], 'downloadBounded'> => ({
  downloadBounded: (key: string, bucket: BucketBinding, maxBytes: number) =>
    assertBucketBinding(key, bucket).pipe(
      Effect.andThen(
        boundedDownload(key, maxBytes, () => s3DownloadWithin(client, s3Bucket, key, maxBytes))
      )
    ),
})

/** The S3 provider: bytes in the configured bucket, metadata in the catalog. */
export const makeS3Storage = (
  config: S3StorageEnvConfig
): Effect.Effect<StorageService['Service']> =>
  Effect.gen(function* () {
    const client = createS3Client(config)
    const { bucket: s3Bucket } = config
    // ADVISORY, not fatal, and at most once per process — see
    // {@link warnIfS3BucketUnreachable} and ./s3-bucket-probe.
    // effect-promise: total -- `warnIfS3BucketUnreachable` only awaits `probeS3BucketOnce`, which converts every rejection into a value; neither has a failure mode.
    yield* Effect.promise(() => warnIfS3BucketUnreachable(client, config.endpoint, s3Bucket))
    return StorageService.of({
      upload: s3StorageUpload(client, s3Bucket),
      ...s3Reads(client, s3Bucket),
      delete: (key: string, bucket: BucketBinding) =>
        attempt(() => deleteFileMetadata(key, bucket)).pipe(
          Effect.flatMap((found) =>
            found
              ? attempt(() => s3Delete(client, s3Bucket, key))
              : Effect.fail(makeError(storageObjectNotFound(key)))
          )
        ),
      deleteUncataloguedBytes: (key: string) => attempt(() => s3Delete(client, s3Bucket, key)),
      getSignedUrl: (key: string, expiresIn: number) =>
        attempt(() => s3GetSignedUrl(client, s3Bucket, key, expiresIn)),
      getMetadata: getMetadataFromCatalog,
      findOtherSpelling: findOtherSpellingIn(S3_STORE),
      statObject: (key: string) => storedObjectSize(key, () => s3StoredSize(client, s3Bucket, key)),
      objectIdentity: (key: string) =>
        storedObjectIdentity(
          absentWhileClaimed(key, () => s3ObjectIdentity(client, s3Bucket, key))
        ),
      hashObject: (key: string) => attempt(() => s3HashObject(client, s3Bucket, key)),
      list: (prefix: string) =>
        attempt(() => s3List(client, s3Bucket, prefix)).pipe(
          Effect.map((page) => unwrapS3Listing(page.keys, page.truncated, 'list', s3Bucket)),
          Effect.flatMap((keys) => attempt(() => withoutClaimedKeys(keys)))
        ),
      listPage: (input) =>
        attempt(async () => {
          const page = await s3ListPage(client, s3Bucket, input)
          return { ...page, keys: await withoutClaimedKeys(page.keys) }
        }),
      catalogBuckets: catalogBucketsOf,
      getTotalBytes: attempt(() => s3GetTotalBytes(client, s3Bucket)).pipe(
        Effect.map((total) =>
          unwrapS3Listing(total.bytes, total.truncated, 'getTotalBytes', s3Bucket)
        )
      ),
    })
  }).pipe(Effect.withSpan('storage.make-s3-storage'))
