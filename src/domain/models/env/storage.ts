/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const StorageProviderType = Schema.Literal('s3', 'local', 'bytea')

export type StorageProvider = Schema.Schema.Type<typeof StorageProviderType>

export const S3StorageEnvSchema = Schema.Struct({
  provider: Schema.Literal('s3'),
  endpoint: Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+/),
    Schema.annotations({
      description: 'S3-compatible endpoint URL (STORAGE_S3_ENDPOINT)',
      examples: ['https://s3.amazonaws.com'],
    })
  ),
  bucket: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'S3 bucket name (STORAGE_S3_BUCKET)',
      examples: ['my-app-files'],
    })
  ),
  region: Schema.String.pipe(
    Schema.annotations({
      description: 'AWS region (STORAGE_S3_REGION, defaults to us-east-1)',
      examples: ['us-east-1', 'eu-west-1'],
    })
  ),
  accessKeyId: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'S3 access key ID (STORAGE_S3_ACCESS_KEY_ID)' })
  ),
  secretAccessKey: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'S3 secret access key (STORAGE_S3_SECRET_ACCESS_KEY)' })
  ),
  forcePathStyle: Schema.Boolean.pipe(
    Schema.annotations({
      description: 'Use path-style URLs for MinIO compatibility (STORAGE_S3_FORCE_PATH_STYLE)',
    })
  ),
})

export const LocalStorageEnvSchema = Schema.Struct({
  provider: Schema.Literal('local'),
  directory: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Local directory for file storage (STORAGE_LOCAL_DIRECTORY)',
      examples: ['./uploads'],
    })
  ),
})

export const ByteaStorageEnvSchema = Schema.Struct({
  provider: Schema.Literal('bytea'),
})

export const StorageEnvSchema = Schema.Union(
  S3StorageEnvSchema,
  LocalStorageEnvSchema,
  ByteaStorageEnvSchema
)

export type StorageEnvConfig = Schema.Schema.Type<typeof StorageEnvSchema>
export type S3StorageEnvConfig = Schema.Schema.Type<typeof S3StorageEnvSchema>
export type LocalStorageEnvConfig = Schema.Schema.Type<typeof LocalStorageEnvSchema>

export const STORAGE_TEMP_CLEANUP_AFTER_DEFAULT = 24 * 60 * 60 * 1000

export const parseStorageTempCleanupAfter = (): number => {
  const value = process.env.STORAGE_TEMP_CLEANUP_AFTER
  if (!value) return STORAGE_TEMP_CLEANUP_AFTER_DEFAULT
  const ms = parseInt(value, 10)
  if (isNaN(ms) || ms < 0) return STORAGE_TEMP_CLEANUP_AFTER_DEFAULT
  return ms
}

const warnedLegacyKeys = new Set<string>()
const readS3Env = (canonical: string, legacy: string): string | undefined => {
  const canonicalValue = process.env[canonical]
  if (canonicalValue !== undefined) return canonicalValue
  const legacyValue = process.env[legacy]
  if (legacyValue !== undefined && !warnedLegacyKeys.has(legacy)) {
    warnedLegacyKeys.add(legacy)
    console.warn(
      `[sovrium] Storage env var "${legacy}" is deprecated; rename to "${canonical}". Legacy name will be removed in the next major version.`
    )
  }
  return legacyValue
}

export const parseStorageEnvConfig = (): StorageEnvConfig | undefined => {
  const provider = process.env.STORAGE_PROVIDER

  if (provider === 's3') {
    return Schema.decodeUnknownSync(S3StorageEnvSchema)({
      provider: 's3',
      endpoint: readS3Env('STORAGE_S3_ENDPOINT', 'S3_ENDPOINT'),
      bucket: readS3Env('STORAGE_S3_BUCKET', 'S3_BUCKET'),
      region: readS3Env('STORAGE_S3_REGION', 'S3_REGION') ?? 'us-east-1',
      accessKeyId: readS3Env('STORAGE_S3_ACCESS_KEY_ID', 'S3_ACCESS_KEY_ID'),
      secretAccessKey: readS3Env('STORAGE_S3_SECRET_ACCESS_KEY', 'S3_SECRET_ACCESS_KEY'),
      forcePathStyle: readS3Env('STORAGE_S3_FORCE_PATH_STYLE', 'S3_FORCE_PATH_STYLE') === 'true',
    })
  }

  if (provider === 'local') {
    if (!process.env.STORAGE_LOCAL_DIRECTORY) {
      throw new Error('STORAGE_LOCAL_DIRECTORY is required when STORAGE_PROVIDER=local')
    }
    return Schema.decodeUnknownSync(LocalStorageEnvSchema)({
      provider: 'local',
      directory: process.env.STORAGE_LOCAL_DIRECTORY,
    })
  }

  if (!provider && process.env.DATABASE_URL) {
    return { provider: 'bytea' as const }
  }

  return undefined
}
