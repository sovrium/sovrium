/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  buildEcoOverview,
  type StorageConsumerInput,
} from '@/application/use-cases/admin/eco/get-eco-overview'
import { ecoOverviewResponseSchema } from '@/domain/models/api/admin/eco/overview'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { readEcoIndexTrackerSnapshot } from '@/infrastructure/utils/eco-index-tracker'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'


async function collectStorageConsumers(app: App): Promise<readonly StorageConsumerInput[]> {
  const tableRows: StorageConsumerInput[] = (app.tables ?? []).map((t) => ({
    type: 'table' as const,
    name: sanitizeTableName(t.name),
    bytes: 0,
    retentionDays: null,
  }))

  const bucketBytesProgram = Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.getTotalBytes()
  })
  const bucketResult = await Effect.runPromise(
    bucketBytesProgram.pipe(provideStorageLive, Effect.either)
  )
  const bucketBytes = bucketResult._tag === 'Right' ? bucketResult.right : 0

  const bucketRow: StorageConsumerInput = {
    type: 'bucket',
    name: 'default',
    bytes: bucketBytes,
    retentionDays: null,
  }

  return [...tableRows, bucketRow]
}

export function createHandleGetEcoOverview(app: App) {
  return async function handleGetEcoOverview(c: Context): Promise<Response> {
    const storageConsumers = await collectStorageConsumers(app)
    const env = process.env as Readonly<Record<string, string | undefined>>
    const tracker = readEcoIndexTrackerSnapshot()

    const response = buildEcoOverview({
      env,
      tracker,
      storageConsumers,
    })

    const parsed = ecoOverviewResponseSchema.safeParse(response)
    if (!parsed.success) {
      console.error('[admin] eco/overview response validation failed', parsed.error)
      return c.json(
        { success: false, message: 'Failed to build eco overview', code: 'INTERNAL_ERROR' },
        500
      )
    }

    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data, 200)
  }
}
