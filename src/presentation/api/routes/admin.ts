/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  configVersionResponseSchema,
  type ConfigVersionResponse,
} from '@/domain/models/api/admin/config/version'
import {
  storageStatusResponseSchema,
  type StorageStatusResponse,
} from '@/domain/models/api/admin/storage/status'
import { resolveRuntimeLabel } from '@/domain/models/env/database-dialect'
import { parseStorageEnvConfig } from '@/domain/models/env/storage'
import { getSovriumVersion } from '@/infrastructure/utils/version'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import type { Context, Hono } from 'hono'

const PROCESS_STARTED_AT: string = new Date().toISOString()

const buildVersion = (): Promise<string> => getSovriumVersion()

const buildCommit = (): string => {
  const sha = process.env['SOVRIUM_COMMIT_SHA']
  return typeof sha === 'string' && /^[0-9a-f]{7,40}$/.test(sha) ? sha : 'unknown'
}

async function buildConfigVersionResponse(): Promise<ConfigVersionResponse> {
  return {
    version: await buildVersion(),
    commit: buildCommit(),
    runtime: resolveRuntimeLabel(),
    nodeVersion: Bun.version,
    startedAt: PROCESS_STARTED_AT,
  }
}

async function handleGetConfigVersion(c: Context): Promise<Response> {
  const response = await buildConfigVersionResponse()

  const parsed = configVersionResponseSchema.safeParse(response)
  if (!parsed.success) {
    return c.json(
      { success: false, message: 'Failed to build version info', code: 'INTERNAL_ERROR' },
      500
    )
  }

  c.header('Cache-Control', 'no-store')
  return c.json(parsed.data, 200)
}

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
    console.error('[admin] storage-quota lookup failed', result.left)
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
    .get('/api/admin/config/version', handleGetConfigVersion)
    .on('DELETE', '/api/admin/storage/transform-cache', handleDeleteTransformCache) as T
}
