/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { StorageService, StorageError } from '@/application/ports/services/storage-service'
import {
  parseStorageEnvConfig,
  validateStorageSizeLimits,
} from '@/domain/models/process-env/storage/storage'
import { makeByteaStorage } from './bytea-storage'
import { makeLocalStorage } from './local-storage'
import { findMissingS3EnvVar } from './s3-reachability'
import { makeS3Storage } from './s3-storage'

/**
 * The storage a process runs on when no provider resolves: every operation
 * fails naming how to enable storage, and the quota total reads zero.
 *
 * `parseStorageEnvConfig()` already applies the dialect-aware defaults:
 * PostgreSQL with no STORAGE_PROVIDER → bytea; SQLite (zero-config) with no
 * STORAGE_PROVIDER → local filesystem. It only returns `undefined` when storage
 * is genuinely disabled (no database and no STORAGE_PROVIDER). The matching
 * startup warning "Storage: Not configured (attachment fields will be
 * disabled)" is emitted by collectStoragePhases() in
 * src/infrastructure/server/startup-degradation-phases.ts (this layer is
 * constructed lazily per request, so it can't emit the warning itself).
 */
const notConfigured = (): StorageError =>
  new StorageError({
    cause:
      'No storage provider configured. Set STORAGE_PROVIDER=s3|local or DATABASE_URL to enable file storage.',
  })

const notConfiguredStorage = (): StorageService['Service'] =>
  StorageService.of({
    upload: () => Effect.fail(notConfigured()),
    downloadBounded: () => Effect.fail(notConfigured()),
    delete: () => Effect.fail(notConfigured()),
    deleteUncataloguedBytes: () => Effect.fail(notConfigured()),
    getSignedUrl: () => Effect.fail(notConfigured()),
    getMetadata: () => Effect.fail(notConfigured()),
    findOtherSpelling: () => Effect.fail(notConfigured()),
    statObject: () => Effect.fail(notConfigured()),
    objectIdentity: () => Effect.fail(notConfigured()),
    hashObject: () => Effect.fail(notConfigured()),
    list: () => Effect.fail(notConfigured()),
    listPage: () => Effect.fail(notConfigured()),
    catalogBuckets: () => Effect.fail(notConfigured()),
    getTotalBytes: Effect.succeed(0),
  })

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
    if (config?.provider === 's3') return yield* makeS3Storage(config)
    if (config?.provider === 'local') return yield* makeLocalStorage(config.directory)
    if (!config) return notConfiguredStorage()
    // Auto-fallback: bytea (DATABASE_URL is set).
    return yield* makeByteaStorage
  })
)
