/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Storage provider type.
 *
 * - `s3`: S3-compatible object storage (AWS S3, MinIO, Cloudflare R2)
 * - `local`: Local filesystem storage
 * - `bytea`: PostgreSQL bytea (auto-detected when DATABASE_URL is set)
 */
export const StorageProviderType = Schema.Literal('s3', 'local', 'bytea')

/** @public */
export type StorageProvider = Schema.Schema.Type<typeof StorageProviderType>

/**
 * S3-compatible storage configuration.
 */
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

/**
 * Local filesystem storage configuration.
 */
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

/**
 * PostgreSQL bytea storage configuration (zero-dependency fallback).
 */
export const ByteaStorageEnvSchema = Schema.Struct({
  provider: Schema.Literal('bytea'),
})

/**
 * Unified storage environment configuration (discriminated union).
 */
export const StorageEnvSchema = Schema.Union(
  S3StorageEnvSchema,
  LocalStorageEnvSchema,
  ByteaStorageEnvSchema
)

export type StorageEnvConfig = Schema.Schema.Type<typeof StorageEnvSchema>
export type S3StorageEnvConfig = Schema.Schema.Type<typeof S3StorageEnvSchema>
/** @public */
export type LocalStorageEnvConfig = Schema.Schema.Type<typeof LocalStorageEnvSchema>

/**
 * Detect and parse storage configuration from environment variables.
 *
 * Priority:
 * 1. STORAGE_PROVIDER=s3 → S3 config
 * 2. STORAGE_PROVIDER=local → Local config
 * 3. STORAGE_PROVIDER not set + DATABASE_URL set → bytea
 * 4. Nothing → undefined (storage disabled)
 */
/**
 * Default cleanup interval for temporary automation files (24 hours in ms).
 */
export const STORAGE_TEMP_CLEANUP_AFTER_DEFAULT = 24 * 60 * 60 * 1000

/**
 * Parse STORAGE_TEMP_CLEANUP_AFTER env var.
 *
 * Controls how long temporary automation files (under tmp/automations/)
 * are kept before automatic cleanup. Value in milliseconds.
 *
 * @returns Cleanup interval in milliseconds (default: 86400000 = 24 hours)
 * @public
 */
export const parseStorageTempCleanupAfter = (): number => {
  const value = process.env.STORAGE_TEMP_CLEANUP_AFTER
  if (!value) return STORAGE_TEMP_CLEANUP_AFTER_DEFAULT
  const ms = parseInt(value, 10)
  if (isNaN(ms) || ms < 0) return STORAGE_TEMP_CLEANUP_AFTER_DEFAULT
  return ms
}

/**
 * Read a storage env var, preferring the canonical `STORAGE_S3_*` name and
 * falling back to the legacy `S3_*` name with a one-time deprecation warning.
 *
 * The legacy `S3_*` names are accepted for one minor version to avoid breaking
 * existing deployments, then will be removed in the next major version.
 */
const warnedLegacyKeys = new Set<string>()
const readS3Env = (canonical: string, legacy: string): string | undefined => {
  const canonicalValue = process.env[canonical]
  if (canonicalValue !== undefined) return canonicalValue
  const legacyValue = process.env[legacy]
  if (legacyValue !== undefined && !warnedLegacyKeys.has(legacy)) {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- one-time deprecation tracking
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
      // eslint-disable-next-line functional/no-throw-statements -- mirrors findMissingS3EnvVar pattern: throw so error.message surfaces the env-var name
      throw new Error('STORAGE_LOCAL_DIRECTORY is required when STORAGE_PROVIDER=local')
    }
    return Schema.decodeUnknownSync(LocalStorageEnvSchema)({
      provider: 'local',
      directory: process.env.STORAGE_LOCAL_DIRECTORY,
    })
  }

  // Auto-fallback: bytea when DATABASE_URL is available
  if (!provider && process.env.DATABASE_URL) {
    return { provider: 'bytea' as const }
  }

  return undefined
}
