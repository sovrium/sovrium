/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The body of `GET /api/admin/footprint/overview` — the operator-grade
 * environmental footprint dashboard — as the admin read registry answers it on
 * both of its surfaces (the HTTP route and the MCP admin tool).
 *
 * Reads `process.env.ECO_*` at REQUEST TIME (not boot cache, per
 * user-story implementation note "operator can toggle ECO_INDEX_HEADER and
 * see the panel change on the next refresh"), snapshots the in-memory
 * `X-Eco-Index` tracker, measures per-table and whole-database storage through
 * `StorageFootprintRepository`, harvests the object-store total from the
 * `StorageService`, reads a MEMOISED local-AI reachability result, and builds
 * the response via the pure `buildFootprintOverview` use case.
 *
 * It lives on the presentation side because every one of those telemetry
 * sources is process state the application layer may not import; the read
 * registry reaches it through the `AdminReadHost` port.
 *
 * The one thing this must not do is probe Ollama itself. The probe is a network
 * round trip that spends its full 2s budget precisely when the endpoint is
 * down, and this read is `Cache-Control: no-store` on a page an operator
 * reloads by hand — so it reads through `getCachedOllamaReachable`, which
 * memoises per endpoint with a TTL.
 *
 * No third-party SaaS call is made while answering — the spec verifies this
 * with a network-spy assertion.
 */

import { Effect } from 'effect'
import { StorageFootprintRepository } from '@/application/ports/repositories/footprint/storage-footprint-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import {
  buildFootprintOverview,
  type StorageConsumerInput,
} from '@/application/use-cases/admin/footprint/get-footprint-overview'
import { withBlockTimeout } from '@/application/use-cases/admin/overview-block-timeout'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { resolveOllamaBaseUrl } from '@/domain/models/process-env/ai/ai-eco-routing'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { getCachedOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { StorageFootprintRepositoryLive } from '@/infrastructure/database/repositories/footprint/storage-footprint-repository-live'
import { readEcoIndexTrackerSnapshot } from '@/infrastructure/process/eco-index-tracker'
import { readPageCacheStats } from '@/infrastructure/process/page-cache-telemetry'
import { readProcessMetrics } from '@/infrastructure/process/process-metrics'
import type { App } from '@/domain/models/app'

/**
 * Latency budget for the whole storage panel (milliseconds).
 *
 * The panel's two sources are a database catalog read and an object-store
 * round trip; the latter is a NETWORK call to a third-party endpoint, which
 * can hang for far longer than it can fail. `Effect.result` rescues errors,
 * not slowness — the gap behind an admin gateway timeout — so the
 * assembled panel is additionally bounded on latency. 8s mirrors the
 * cross-domain overview's per-block budget and stays comfortably under Hono's
 * 30s `API_TIMEOUT_MS` ceiling.
 */
const STORAGE_PANEL_TIMEOUT_MS = 8000

/** Storage-panel inputs: consumer rows plus the scoped whole-database total. */
interface StoragePanel {
  readonly consumers: readonly StorageConsumerInput[]
  readonly databaseTotalBytes: number
}

/** A consumer row whose size could not be established. */
const unmeasuredConsumer = (type: 'table' | 'bucket', name: string): StorageConsumerInput => ({
  type,
  name,
  bytes: null,
  measurement: 'unavailable',
})

/**
 * Identify the object store the bucket row describes.
 *
 * A fixed literal such as `'default'` would name nothing: an operator running
 * three deployments against three buckets would see the same word in all
 * three panels. The resolved provider identity — the S3 bucket,
 * the local directory, or `bytea` for the in-database store — is the smallest
 * string that actually distinguishes them.
 *
 * `parseStorageEnvConfig` throws on a half-configured provider (a missing
 * `STORAGE_S3_BUCKET`, say). That is a boot-time concern, not a dashboard one,
 * so a throw here degrades to a labelled row rather than failing the panel.
 */
const resolveStorageName = (): string => {
  try {
    const config = parseStorageEnvConfig()
    if (config === undefined) return 'storage (disabled)'
    if (config.provider === 's3') return config.bucket
    if (config.provider === 'local') return config.directory
    return 'bytea'
  } catch {
    return 'storage (unconfigured)'
  }
}

/**
 * Measure every configured table plus the whole database.
 *
 * A repository failure degrades to `unavailable` rows and a `0` total rather
 * than failing the panel — the dashboard's job is to report what it knows,
 * and "we could not measure this" is a report.
 */
const measureDatabase = (tableNames: readonly string[]): Effect.Effect<StoragePanel> =>
  Effect.gen(function* () {
    const repository = yield* StorageFootprintRepository
    const footprint = yield* repository.measureDatabaseFootprint(tableNames)
    return {
      consumers: footprint.tables.map((row) => ({
        type: 'table' as const,
        name: row.tableName,
        bytes: row.bytes,
        measurement: row.measurement,
      })),
      databaseTotalBytes: footprint.totalBytes,
    }
  }).pipe(
    Effect.provide(StorageFootprintRepositoryLive),
    // effect-swallow: the fallback marks every consumer UNMEASURED rather than reporting zero bytes, so the console shows "not measured" instead of a false all-clear — which is the distinction that makes degrading here safe.
    Effect.orElseSucceed(() => ({
      consumers: tableNames.map((name) => unmeasuredConsumer('table', name)),
      databaseTotalBytes: 0,
    }))
  )

/**
 * Harvest the object store's total for the bucket row.
 *
 * A storage failure (misconfigured provider, unreachable endpoint) yields an
 * `unavailable` row — NOT `0`, which would claim the store was reached and
 * found empty.
 */

const measureBucket = (): Effect.Effect<StorageConsumerInput, never, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    return yield* storage.getTotalBytes
  }).pipe(
    Effect.result,
    Effect.map((result) =>
      result._tag === 'Success'
        ? {
            type: 'bucket' as const,
            name: resolveStorageName(),
            bytes: result.success,
            measurement: 'storage_adapter' as const,
          }
        : unmeasuredConsumer('bucket', resolveStorageName())
    )
  )

/**
 * Collect the storage panel: one row per configured table, one for the object
 * store, plus the scoped whole-database total.
 *
 * The use case ranks and slices to top-3 — the caller does NOT pre-sort.
 */
const collectStoragePanel = (app: App): Effect.Effect<StoragePanel, never, StorageService> => {
  const tableNames = (app.tables ?? []).map((table) => sanitizeTableName(table.name))
  return Effect.all([measureDatabase(tableNames), measureBucket()]).pipe(
    Effect.map(([database, bucket]) => ({
      consumers: [...database.consumers, bucket],
      databaseTotalBytes: database.databaseTotalBytes,
    }))
  )
}

/** Panel substituted when the collection exceeds its latency budget. */
const timedOutPanel = (app: App): StoragePanel => ({
  consumers: [
    ...(app.tables ?? []).map((table) =>
      unmeasuredConsumer('table', sanitizeTableName(table.name))
    ),
    unmeasuredConsumer('bucket', resolveStorageName()),
  ],
  databaseTotalBytes: 0,
})

/**
 * Assemble the footprint body for `app`. Unvalidated: the read registry entry
 * validates it against `footprintOverviewResponseSchema`, on both surfaces.
 */
export const assembleFootprintOverview = (
  app: App
): Effect.Effect<unknown, never, StorageService> =>
  Effect.gen(function* () {
    const env = process.env as Readonly<Record<string, string | undefined>>
    // Storage measurement and the reachability read are independent, so they
    // run together rather than in series. On a cold memo the second one costs
    // a probe; on every subsequent request it costs nothing.
    const [panel, ollamaReachable] = yield* Effect.all(
      [
        withBlockTimeout(collectStoragePanel(app), timedOutPanel(app), STORAGE_PANEL_TIMEOUT_MS),
        // effect-promise: total -- getCachedOllamaReachable memoises probeOllamaReachable, which catches every fetch failure and answers false
        Effect.promise(() => getCachedOllamaReachable(resolveOllamaBaseUrl(env))),
      ],
      { concurrency: 'unbounded' }
    )
    const tracker = readEcoIndexTrackerSnapshot()
    const pageCache = readPageCacheStats()
    // Read AFTER the awaits, so the CPU and memory figures cover the work this
    // request just did rather than the state it found on arrival.
    const runtime = readProcessMetrics()

    return buildFootprintOverview({
      env,
      tracker,
      storageConsumers: panel.consumers,
      databaseTotalBytes: panel.databaseTotalBytes,
      ollamaReachable,
      pageCache,
      runtime,
    })
  })
