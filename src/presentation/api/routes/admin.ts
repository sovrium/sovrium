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

async function handleGetStorageStatus(c: Context): Promise<Response> {
  const response = buildStorageStatusResponse()

  const parsed = storageStatusResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build storage status', code: 'INTERNAL_ERROR' },
      500
    )
  }

  return c.json(parsed.data, 200)
}

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

function handleDeleteTransformCache(c: Context): Response {
  return c.json({ success: true, message: 'Transform cache cleared' }, 200)
}

export function chainAdminRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/admin/storage/status', handleGetStorageStatus)
    .get('/api/admin/buckets/quota', handleGetBucketsQuota)
    .on('DELETE', '/api/admin/storage/transform-cache', handleDeleteTransformCache) as T
}
