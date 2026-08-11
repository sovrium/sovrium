/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/eco/overview` route handler — operator-grade
 * environmental footprint dashboard.
 *
 * Reads `process.env.ECO_*` at REQUEST TIME (not boot cache, per
 * user-story implementation note "operator can toggle ECO_INDEX_HEADER and
 * see the panel change on the next refresh"), snapshots the in-memory
 * `X-Eco-Index` tracker, collects per-table storage rows (lazy — table-list
 * comes from the live App; bucket rows come from the StorageService), and
 * builds the response via the pure `buildEcoOverview` use case.
 *
 * Auth gating is handled upstream by `requireAdminTier()` in
 * `api-routes.ts`. Unauthenticated and non-admin-tier callers receive 404
 * per anti-enumeration (S1).
 *
 * No third-party SaaS call is made during request handling — the spec
 * verifies this with a network-spy assertion.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  buildEcoOverview,
  type StorageConsumerInput,
} from '@/application/use-cases/admin/eco/get-eco-overview'
import { ecoOverviewResponseSchema } from '@/domain/models/api/admin/eco/overview'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { logError } from '@/infrastructure/logging/logger'
import { readEcoIndexTrackerSnapshot } from '@/infrastructure/utils/eco-index-tracker'
import { provideStorageLive } from '@/presentation/api/routes/buckets/effect-runner'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Collect storage consumer rows for the top-3 panel.
 *
 * Returns one synthetic row per declared table (with `bytes = 0` until a
 * future tier-2 PR threads `pg_total_relation_size`) plus one row for the
 * default bucket. The use case sorts and slices to top-3 — the caller does
 * NOT need to pre-sort.
 *
 * The bucket row's `bytes` is harvested from the live StorageService when
 * one is configured; storage failures fall back to `0` so the dashboard
 * never 500s on a storage misconfiguration.
 */
/* eslint-disable unicorn/no-null -- the eco-overview API contract uses `null` for absent retention horizons (matches every other admin overview schema's nullable retentionDays); switching to `undefined` would diverge from the JSON shape end-clients consume */

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

/**
 * Build the handler factory bound to an App. The factory closes over `app`
 * so the handler can enumerate configured tables for the storage panel
 * without re-importing the runtime App state on every call.
 */
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
      logError(
        '[admin] eco/overview response validation failed',
        parsed.error,
        requestLogAttributes(c)
      )
      return c.json(
        { success: false, message: 'Failed to build eco overview', code: 'INTERNAL_ERROR' },
        500
      )
    }

    c.header('Cache-Control', 'no-store')
    return c.json(parsed.data, 200)
  }
}
