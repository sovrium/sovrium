/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { defaultUploadsDir } from '@/domain/models/process-env/data-dir'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * Storage provider type.
 *
 * - `s3`: S3-compatible object storage (AWS S3, MinIO, Cloudflare R2)
 * - `local`: Local filesystem storage
 * - `bytea`: PostgreSQL bytea (auto-detected when DATABASE_URL is set)
 */
export const StorageProviderType = Schema.Literals(['s3', 'local', 'bytea'])

/** @public */
export type StorageProvider = Schema.Schema.Type<typeof StorageProviderType>

/**
 * S3-compatible storage configuration.
 */
export const S3StorageEnvSchema = Schema.Struct({
  provider: Schema.Literal('s3'),
  endpoint: Schema.String.pipe(
    Schema.check(Schema.isPattern(/^https?:\/\/.+/)),
    Schema.annotate({
      description: 'S3-compatible endpoint URL (STORAGE_S3_ENDPOINT)',
      examples: ['https://s3.amazonaws.com'],
    })
  ),
  bucket: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
      description: 'S3 bucket name (STORAGE_S3_BUCKET)',
      examples: ['my-app-files'],
    })
  ),
  region: Schema.String.pipe(
    Schema.annotate({
      description: 'AWS region (STORAGE_S3_REGION, defaults to us-east-1)',
      examples: ['us-east-1', 'eu-west-1'],
    })
  ),
  accessKeyId: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({ description: 'S3 access key ID (STORAGE_S3_ACCESS_KEY_ID)' })
  ),
  secretAccessKey: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({ description: 'S3 secret access key (STORAGE_S3_SECRET_ACCESS_KEY)' })
  ),
  forcePathStyle: Schema.Boolean.pipe(
    Schema.annotate({
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
    Schema.check(Schema.isMinLength(1)),
    Schema.annotate({
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
export const StorageEnvSchema = Schema.Union([
  S3StorageEnvSchema,
  LocalStorageEnvSchema,
  ByteaStorageEnvSchema,
])

export type StorageEnvConfig = Schema.Schema.Type<typeof StorageEnvSchema>
export type S3StorageEnvConfig = Schema.Schema.Type<typeof S3StorageEnvSchema>
/** @public */
export type LocalStorageEnvConfig = Schema.Schema.Type<typeof LocalStorageEnvSchema>

/**
 * Validate a positive-integer storage size-limit env var.
 *
 * `STORAGE_MAX_FILE_SIZE` and `STORAGE_MAX_TOTAL_SIZE` must, when set, be
 * positive integers (bytes). Negative, zero, or non-numeric values are
 * configuration mistakes that must surface at startup with a descriptive
 * error naming the offending env var — rather than being silently ignored
 * (which would defeat the operator's intended quota / size cap).
 *
 * Mirrors the throw-so-the-name-surfaces pattern used for the missing
 * `STORAGE_LOCAL_DIRECTORY` / `S3_*` env vars.
 *
 * @throws Error when the env var is set to an invalid value.
 */
const validateStorageSizeLimitVar = (name: string): void => {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    // eslint-disable-next-line functional/no-throw-statements -- mirrors parseStorageEnvConfig: throw so error.message surfaces the env-var name at startup
    throw new Error(`Invalid ${name}: expected a positive integer number of bytes, got "${raw}"`)
  }
}

/**
 * Validate the storage size-limit environment variables at startup.
 *
 * Called eagerly during `StorageServiceLive` construction so misconfigured
 * `STORAGE_MAX_FILE_SIZE` / `STORAGE_MAX_TOTAL_SIZE` values fail the boot
 * with a descriptive error instead of being silently dropped at upload time.
 *
 * @public
 * @throws Error when either env var is set to an invalid value.
 */
export const validateStorageSizeLimits = (): void => {
  validateStorageSizeLimitVar('STORAGE_MAX_FILE_SIZE')
  validateStorageSizeLimitVar('STORAGE_MAX_TOTAL_SIZE')
}

/**
 * Detect and parse storage configuration from environment variables.
 *
 * Priority:
 * 1. `STORAGE_PROVIDER=s3` → S3 config (either database dialect)
 * 2. `STORAGE_PROVIDER=local` → Local config (requires `STORAGE_LOCAL_DIRECTORY`)
 * 3. `STORAGE_PROVIDER` unset + PostgreSQL dialect (`DATABASE_URL` set) → bytea
 *    (zero-dependency auto-fallback — bytea needs a Postgres connection)
 * 4. `STORAGE_PROVIDER` unset + SQLite dialect (zero-config default) → local
 *    filesystem at `STORAGE_LOCAL_DIRECTORY ?? <dataDir>/uploads`. SQLite mode has no
 *    bytea fallback (bytea requires Postgres), so a working filesystem store is
 *    the frugal-by-default choice — mirrors how SQLite itself is the default
 *    database. See plan "Resolved Decisions" §1.
 * 5. Nothing matches → undefined (storage disabled)
 *
 * @returns the resolved storage config, or `undefined` when storage is disabled
 * @public
 */
export const parseStorageEnvConfig = (): StorageEnvConfig | undefined => {
  const provider = process.env.STORAGE_PROVIDER

  if (provider === 's3') {
    return Schema.decodeUnknownSync(S3StorageEnvSchema)({
      provider: 's3',
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      bucket: process.env.STORAGE_S3_BUCKET,
      region: process.env.STORAGE_S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY,
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
    })
  }

  if (provider === 'local') {
    if (!process.env.STORAGE_LOCAL_DIRECTORY) {
      // eslint-disable-next-line functional/no-throw-statements -- mirrors findMissingS3EnvVar pattern: throw so error.message surfaces the env-var name
      throw new Error('STORAGE_LOCAL_DIRECTORY is required when STORAGE_PROVIDER=local')
    }
    return Schema.decodeSync(LocalStorageEnvSchema)({
      provider: 'local',
      directory: process.env.STORAGE_LOCAL_DIRECTORY,
    })
  }

  // No explicit STORAGE_PROVIDER — pick a default keyed off the database dialect.
  if (!provider) {
    const { dialect } = parseDatabaseDialectConfig()
    // PostgreSQL: auto-fallback to bytea (needs the Postgres connection).
    if (dialect === 'postgres') {
      return { provider: 'bytea' as const }
    }
    // SQLite (zero-config default): default to local filesystem storage. bytea
    // is not available without Postgres, so a working filesystem store is the
    // frugal-by-default choice. STORAGE_LOCAL_DIRECTORY overrides the default.
    return Schema.decodeSync(LocalStorageEnvSchema)({
      provider: 'local',
      directory: process.env.STORAGE_LOCAL_DIRECTORY || defaultUploadsDir(),
    })
  }

  return undefined
}
