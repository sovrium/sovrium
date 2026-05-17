/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  storageStatusResponseSchema,
  type StorageStatusResponse,
} from '@/domain/models/api/admin/storage/status'
import { parseStorageEnvConfig } from '@/domain/models/env/storage'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import type { Context, Hono } from 'hono'

/**
 * Build the storage status response from the active environment configuration.
 *
 * - Returns `provider: 'disabled'` when no provider is configured.
 * - Returns S3-specific fields (region, bucket, endpoint, forcePathStyle) for S3.
 * - Returns `directory` for local storage.
 * - Returns only `provider` for bytea.
 */
function buildStorageStatusResponse(): StorageStatusResponse {
  const config = parseStorageEnvConfig()

  if (!config) {
    return { provider: 'disabled' }
  }

  if (config.provider === 's3') {
    return {
      provider: 's3',
      region: config.region,
      bucket: config.bucket,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    }
  }

  if (config.provider === 'local') {
    return {
      provider: 'local',
      directory: config.directory,
    }
  }

  return { provider: 'bytea' }
}

/**
 * Handle GET /api/admin/storage/status — admin only
 *
 * Returns the active storage configuration so administrators can verify
 * provider selection and confirm which optional values (e.g. region) were
 * applied via defaults.
 *
 * Authentication and admin-role enforcement are wired upstream via
 * `authMiddleware`, `requireAuth`, and `requireAdmin` in `api-routes.ts`.
 */
async function handleGetStorageStatus(c: Context): Promise<Response> {
  const response = buildStorageStatusResponse()

  // Validate the response against the schema (defence-in-depth — guarantees
  // the OpenAPI contract holds even if `parseStorageEnvConfig` evolves).
  const parsed = storageStatusResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build storage status', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(parsed.data, 200)
}

/**
 * Handle GET /api/admin/buckets/quota — admin only
 *
 * Returns current storage usage statistics: total bytes used across all stored
 * files and the number of files. Useful for administrators to monitor quota
 * consumption before enforcing STORAGE_MAX_TOTAL_SIZE limits.
 */
async function handleGetBucketsQuota(c: Context): Promise<Response> {
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    const [totalBytes, keys] = yield* Effect.all([storage.getTotalBytes(), storage.list('')])
    return { totalBytes, fileCount: keys.length }
  })

  const result = await Effect.runPromise(program.pipe(provideStorageLive, Effect.either))
  if (result._tag === 'Left') {
    return c.json(
      { success: false, error: 'Failed to retrieve storage quota', code: 'STORAGE_ERROR' },
      500
    )
  }

  return c.json(result.right, 200)
}

/**
 * Chain admin routes onto a Hono app.
 *
 * Provides:
 * - GET /api/admin/storage/status — returns the active storage configuration
 *   (provider, region, bucket, etc.) so administrators can verify the env
 *   wiring at runtime.
 * - GET /api/admin/buckets/quota — returns current storage usage statistics
 *   (totalBytes, fileCount) for quota monitoring.
 *
 * Auth gating (admin-only) is wired upstream in `createApiRoutes`.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with admin routes chained
 */
export function chainAdminRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/storage/status', handleGetStorageStatus)
    .get('/api/admin/buckets/quota', handleGetBucketsQuota) as T
}
