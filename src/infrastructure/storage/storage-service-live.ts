/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import { StorageService, StorageError } from '@/application/ports/services/storage-service'
import { parseStorageEnvConfig, validateStorageSizeLimits } from '@/domain/models/env/storage'
import {
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

const makeError = (cause: unknown): StorageError => new StorageError({ cause })

const getMetadataFromCatalog = (
  key: string
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
      meta
        ? Effect.succeed({ key, ...meta })
        : Effect.fail(makeError(new Error(`File not found: ${key}`)))
    )
  )

const signedUploadUrlUnsupported = (provider: string): Effect.Effect<string, StorageError> =>
  Effect.fail(
    new StorageError({ cause: `Signed upload URLs not supported for ${provider} storage` })
  )

const findMissingS3EnvVar = (): string | undefined => {
  if (process.env.STORAGE_PROVIDER !== 's3') return undefined
  const requiredS3LegacyVars: ReadonlyArray<string> = [
    'S3_BUCKET',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ]
  const anyLegacySet = requiredS3LegacyVars.some((name) => process.env[name] !== undefined)
  if (!anyLegacySet) return undefined
  return requiredS3LegacyVars.find((name) => !process.env[name])
}

export const StorageServiceLive = Layer.effect(
  StorageService,
  Effect.gen(function* () {
    validateStorageSizeLimits()
    const missingS3Var = findMissingS3EnvVar()
    if (missingS3Var) {
      throw new Error(`Required env var ${missingS3Var} is missing`)
    }
    const config = parseStorageEnvConfig()

    if (config?.provider === 's3') {
      const client = createS3Client(config)
      const { bucket } = config
      yield* Effect.tryPromise({
        try: () => s3ValidateBucket(client, bucket),
        catch: (e: unknown) =>
          new StorageError({ cause: `S3 bucket "${bucket}" is not accessible: ${e}` }),
      })
      return StorageService.of({
        upload: (key: string, content: Uint8Array, mimeType: string) =>
          Effect.tryPromise({
            try: () =>
              s3Upload({ client, bucket, key, content, mimeType }).then(() =>
                writeFileMetadata(key, mimeType, content.length, 's3')
              ),
            catch: (e: unknown) => makeError(e),
          }),
        download: (key: string) =>
          Effect.tryPromise({
            try: () => s3Download(client, bucket, key),
            catch: (e: unknown) => makeError(e),
          }),
        delete: (key: string) =>
          Effect.tryPromise({
            try: () => deleteFileMetadata(key),
            catch: (e: unknown) => makeError(e),
          }).pipe(
            Effect.flatMap((found) =>
              found
                ? Effect.tryPromise({
                    try: () => s3Delete(client, bucket, key),
                    catch: (e: unknown) => makeError(e),
                  })
                : Effect.fail(makeError(new Error(`File not found: ${key}`)))
            )
          ),
        getSignedUrl: (key: string, expiresIn: number) =>
          Effect.tryPromise({
            try: () => s3GetSignedUrl(client, bucket, key, expiresIn),
            catch: (e: unknown) => makeError(e),
          }),
        getSignedUploadUrl: (key: string, expiresIn: number, contentType?: string) =>
          Effect.tryPromise({
            try: () => s3GetSignedUploadUrl({ client, bucket, key, expiresIn, contentType }),
            catch: (e: unknown) => makeError(e),
          }),
        getMetadata: getMetadataFromCatalog,
        list: (prefix: string) =>
          Effect.tryPromise({
            try: () => s3List(client, bucket, prefix),
            catch: (e: unknown) => makeError(e),
          }),
        getTotalBytes: () =>
          Effect.tryPromise({
            try: () => s3GetTotalBytes(client, bucket),
            catch: (e: unknown) => makeError(e),
          }),
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
        upload: (key: string, content: Uint8Array, _mimeType: string) =>
          Effect.tryPromise({
            try: () => localUpload(dir, key, content),
            catch: (e: unknown) => makeError(e),
          }),
        download: (key: string) =>
          Effect.tryPromise({
            try: () => localDownload(dir, key),
            catch: (e: unknown) => makeError(e),
          }),
        delete: (key: string) =>
          Effect.tryPromise({
            try: () => localDelete(dir, key),
            catch: (e: unknown) => makeError(e),
          }),
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
        getTotalBytes: () =>
          Effect.tryPromise({
            try: () => localGetTotalBytes(dir),
            catch: (e: unknown) => makeError(e),
          }),
      })
    }

    if (!config && !process.env.DATABASE_URL) {
      const notConfigured = (): StorageError =>
        new StorageError({
          cause:
            'No storage provider configured. Set STORAGE_PROVIDER=s3|local or DATABASE_URL to enable file storage.',
        })
      return StorageService.of({
        upload: (_key: string, _content: Uint8Array, _mimeType: string) =>
          Effect.fail(notConfigured()),
        download: (_key: string) => Effect.fail(notConfigured()),
        delete: (_key: string) => Effect.fail(notConfigured()),
        getSignedUrl: (_key: string, _expiresIn: number) => Effect.fail(notConfigured()),
        getSignedUploadUrl: (_key: string, _expiresIn: number, _contentType?: string) =>
          Effect.fail(notConfigured()),
        getMetadata: (_key: string) => Effect.fail(notConfigured()),
        list: (_prefix: string) => Effect.fail(notConfigured()),
        getTotalBytes: () => Effect.succeed(0),
      })
    }

    yield* Effect.tryPromise({
      try: () => byteaValidateAndInit(),
      catch: (e: unknown) =>
        new StorageError({
          cause: `Bytea storage initialization failed (DATABASE_URL): ${e}`,
        }),
    })

    return StorageService.of({
      upload: (key: string, content: Uint8Array, mimeType: string) =>
        Effect.tryPromise({
          try: () => byteaUpload(key, content, mimeType),
          catch: (e: unknown) => makeError(e),
        }),
      download: (key: string) =>
        Effect.tryPromise({
          try: () => byteaDownload(key),
          catch: (e: unknown) => makeError(e),
        }),
      delete: (key: string) =>
        Effect.tryPromise({
          try: () => byteaDelete(key),
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
      getTotalBytes: () =>
        Effect.tryPromise({
          try: () => byteaGetTotalBytes(),
          catch: (e: unknown) => makeError(e),
        }),
    })
  })
)
