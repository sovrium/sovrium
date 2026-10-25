/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  parseStorageEnvConfig,
  validateStorageSizeLimits,
} from '@/domain/models/process-env/storage/storage'
import { makeByteaStorage } from './bytea-storage'
import { makeLocalStorage } from './local-storage'
import { findMissingS3EnvVar } from './s3-reachability'
import { makeS3Storage } from './s3-storage'

/**
 * `parseStorageEnvConfig()` applies the dialect-aware defaults (PostgreSQL with
 * no STORAGE_PROVIDER → bytea; SQLite → local filesystem) and refuses any
 * other value, so file storage always resolves to a backend.
 */
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
    if (config.provider === 's3') return yield* makeS3Storage(config)
    if (config.provider === 'local') return yield* makeLocalStorage(config.directory)
    // Auto-fallback: bytea (DATABASE_URL is set).
    return yield* makeByteaStorage
  })
)
