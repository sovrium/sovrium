/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { nowSqlLiteral } from '@/infrastructure/database/sql/dialect-ddl'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { App } from '@/domain/models/app'


const APP_METRICS_TABLE = 'app_metrics'

const APPS_TABLE = 'apps'

const METRIC_CPU = 'cpu-percent'

const METRIC_MEMORY_MB = 'memory-mb'

const DEFAULT_INTERVAL_MS = 30_000

const MIN_INTERVAL_MS = 50

const sqliteDb = (): any => db as any

let timer: ReturnType<typeof setInterval> | undefined

let installedApp: Readonly<App> | undefined

let lastCpu: Readonly<NodeJS.CpuUsage> | undefined

let lastSampleAt: number | undefined

const appDeclaresMetrics = (app: Readonly<App>): boolean =>
  (app.tables ?? []).some((table) => table.name === APP_METRICS_TABLE)

const appDeclaresAppsRegistry = (app: Readonly<App>): boolean =>
  (app.tables ?? []).some((table) => table.name === APPS_TABLE)

const resolveIntervalMs = (): number => {
  const raw = process.env.SOVRIUM_CLOUD_METRICS_INTERVAL_MS
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_INTERVAL_MS
  return Math.max(parsed, MIN_INTERVAL_MS)
}

const sampleCpuPercent = (now: number): number => {
  const current = process.cpuUsage()
  const previous = lastCpu
  const previousAt = lastSampleAt
  lastCpu = current
  lastSampleAt = now
  if (previous === undefined || previousAt === undefined) return 0
  const elapsedMs = now - previousAt
  if (elapsedMs <= 0) return 0
  const cpuMicros = current.user - previous.user + (current.system - previous.system)
  const percent = (cpuMicros / (elapsedMs * 1000)) * 100
  return Math.max(0, Math.round(percent * 100) / 100)
}

const sampleMemoryMb = (): number => Math.round((process.memoryUsage().rss / 1_048_576) * 100) / 100

interface MetricSample {
  readonly app: string
  readonly metric: string
  readonly value: number
}

const insertSamplePg = async (sample: MetricSample): Promise<void> => {
  await db.execute(sql`
    INSERT INTO ${sql.identifier(APP_METRICS_TABLE)} ("app", "metric", "value", "sampled_at")
    VALUES (${sample.app}, ${sample.metric}, ${sample.value}, ${sql.raw(nowSqlLiteral())})
  `)
}

const insertSampleSqlite = async (sample: MetricSample): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql`
    INSERT INTO ${sql.identifier(APP_METRICS_TABLE)} (app, metric, value, sampled_at)
    VALUES (${sample.app}, ${sample.metric}, ${sample.value}, ${sql.raw(nowSqlLiteral())})
  `)
}

const persist = async (sample: MetricSample): Promise<void> => {
  try {
    await (isSqliteRuntime() ? insertSampleSqlite(sample) : insertSamplePg(sample))
  } catch {
  }
}

const resolveRunningSlugs = async (app: Readonly<App>): Promise<readonly string[]> => {
  if (!appDeclaresAppsRegistry(app)) return [app.name]
  try {
    const query = sql`SELECT id FROM ${sql.identifier(APPS_TABLE)} WHERE status = ${'running'}`
    const result = isSqliteRuntime()
      ? ((await sqliteDb().all(query)) as ReadonlyArray<{ readonly id: unknown }>)
      : ((await db.execute(query)) as unknown as ReadonlyArray<{ readonly id: unknown }>)
    return result
      .map((row) => row.id)
      .filter((id): id is string | number => id !== null && id !== undefined)
      .map((id) => String(id))
  } catch {
    return []
  }
}

const sampleOnce = async (app: Readonly<App>): Promise<void> => {
  const now = Date.now()
  const cpuPercent = sampleCpuPercent(now)
  const memoryMb = sampleMemoryMb()
  const slugs = await resolveRunningSlugs(app)
  await Promise.all(
    slugs.flatMap((slug) => [
      persist({ app: slug, metric: METRIC_CPU, value: cpuPercent }),
      persist({ app: slug, metric: METRIC_MEMORY_MB, value: memoryMb }),
    ])
  )
}

export const installHostMetricsCollector = (app: Readonly<App>): (() => void) => {
  if (!appDeclaresMetrics(app)) return () => undefined
  if (timer) return uninstallHostMetricsCollector

  installedApp = app
  lastCpu = undefined
  lastSampleAt = undefined
  const intervalMs = resolveIntervalMs()
  timer = setInterval(() => {
    const current = installedApp
    if (current === undefined) return
    void sampleOnce(current)
  }, intervalMs)
  timer.unref?.()

  return uninstallHostMetricsCollector
}

export const uninstallHostMetricsCollector = (): void => {
  if (!timer) return
  clearInterval(timer)
  timer = undefined
  installedApp = undefined
  lastCpu = undefined
  lastSampleAt = undefined
}
