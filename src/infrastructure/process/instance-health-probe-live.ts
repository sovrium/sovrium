/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live `InstanceHealthProbe`: one bounded probe per part of the instance.
 *
 *  - **Database**: the readiness probe's `SELECT 1` within its 2 s budget.
 *  - **File storage**: the cheapest read the configured provider has — the
 *    data directory is readable (`local`), the storage table answers a query
 *    (`bytea`), the bucket answers a metadata request (`s3`, cached 60 s).
 *  - **AI provider**: a `GET` of the provider's model list within 2 s, any
 *    answer below 500 counting as reachable; refused, timed out or 5xx is
 *    degraded. No credential is sent, so no token is spent, and the verdict is
 *    cached for 60 s per provider and endpoint.
 *
 * Every probe resolves its verdict and never rejects, so each `Effect.promise`
 * here is total. A cache entry holds the in-flight PROMISE, so concurrent
 * overview reads during a cold probe share one request.
 */

import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import { InstanceHealthProbe } from '@/application/ports/services/instance-health-probe'
import {
  resolveBaseUrl,
  type SupportedAiProvider,
} from '@/domain/models/process-env/ai/ai-providers'
import { parseStorageEnvConfig } from '@/domain/models/process-env/storage/storage'
import { probeDatabaseReadiness } from '@/infrastructure/database/database-readiness'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'
import { createS3Client } from '@/infrastructure/storage/s3-adapter'
import type { InstanceComponentHealth } from '@/domain/models/api/admin/overview/attention'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/** How long one probe may take before it counts as degraded (ms). */
const PROBE_BUDGET_MS = 2000

/** How long a network probe's verdict is reused (ms). */
const PROBE_TTL_MS = 60_000

/** The key a bucket probe asks about: its existence is never the question, the answer is. */
const S3_PROBE_KEY = '.sovrium-health-probe'

const verdict = (answered: boolean): InstanceComponentHealth => (answered ? 'healthy' : 'degraded')

/**
 * Whether `attempt` settles successfully within the budget. Never rejects: a
 * failure and a timeout both resolve `false`.
 */
const answersWithin = (attempt: () => Promise<unknown>): Promise<boolean> => {
  const timers = new Map<'timer', ReturnType<typeof setTimeout>>()
  const deadline = new Promise<boolean>((resolve) => {
    timers.set(
      'timer',
      setTimeout(() => resolve(false), PROBE_BUDGET_MS)
    )
  })
  const settled = Promise.resolve()
    .then(attempt)
    .then(
      () => true,
      () => false
    )
  return Promise.race([settled, deadline]).finally(() => clearTimeout(timers.get('timer')))
}

/** A probe verdict reused until it expires, keyed by what it was taken against. */
interface CachedVerdict {
  readonly expiresAt: number
  readonly result: Promise<InstanceComponentHealth>
}

const cache = new Map<string, CachedVerdict>()

/** The verdict under `key`, probing again once the cached one is older than the TTL. */
const cached = (
  key: string,
  probe: () => Promise<InstanceComponentHealth>
): Promise<InstanceComponentHealth> => {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit !== undefined && hit.expiresAt > now) return hit.result
  const result = probe()
  cache.set(key, { expiresAt: now + PROBE_TTL_MS, result })
  return result
}

/** The configured storage provider's cheapest read; the database provider's through `db`. */
const probeStorage = async ({
  client: db,
  dialect,
}: DatabaseService): Promise<InstanceComponentHealth> => {
  const config = await Promise.resolve()
    .then(() => parseStorageEnvConfig(process.env))
    .catch(() => undefined)
  if (config === undefined) return 'degraded'
  if (config.provider === 'local') {
    return verdict(await answersWithin(() => access(config.directory, constants.R_OK)))
  }
  if (config.provider === 'bytea') {
    return verdict(
      await answersWithin(() =>
        executeRawOn(dialect.kind, db, sql`SELECT 1 FROM system.file_storage_metadata LIMIT 1`)
      )
    )
  }
  return cached(`s3|${config.endpoint}|${config.bucket}`, async () =>
    verdict(await answersWithin(() => createS3Client(config).exists(S3_PROBE_KEY)))
  )
}

/** The address of the provider's model list, or `undefined` when it has no endpoint. */
const modelListUrl = (provider: SupportedAiProvider): string | undefined => {
  const base = resolveBaseUrl(provider, process.env)?.replace(/\/+$/, '')
  if (base === undefined || base.length === 0) return undefined
  return provider === 'ollama' ? `${base}/api/tags` : `${base}/models`
}

/** Whether the provider's model list answers below 500 within the budget. */
const probeAiProvider = (provider: SupportedAiProvider): Promise<InstanceComponentHealth> => {
  const url = modelListUrl(provider)
  if (url === undefined) return Promise.resolve('degraded')
  return cached(`ai|${provider}|${url}`, async () => {
    const response = await withFetchTimeout(url, { method: 'GET' }, PROBE_BUDGET_MS).catch(
      () => undefined
    )
    return verdict(response !== undefined && response.status < 500)
  })
}

export const InstanceHealthProbeLive = Layer.effect(
  InstanceHealthProbe,
  Effect.map(Database, (database) =>
    InstanceHealthProbe.of({
      database: Effect.map(
        // effect-promise: total -- probeDatabaseReadiness reports a failed or slow query as an outcome and never rejects
        Effect.promise(() => probeDatabaseReadiness(database, PROBE_BUDGET_MS)),
        (outcome) => verdict(outcome === 'ok')
      ),
      // effect-promise: total -- probeStorage resolves `degraded` on every failure, timeout or unreadable config
      storage: Effect.promise(() => probeStorage(database)),
      // effect-promise: total -- probeAiProvider resolves `degraded` on a refused, timed-out or unaddressable request
      aiProvider: (provider) => Effect.promise(() => probeAiProvider(provider)),
    })
  )
)
