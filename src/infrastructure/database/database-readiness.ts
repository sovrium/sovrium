/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whether the database answers, as the readiness probe sees it.
 *
 * `GET /api/health` says the process can answer HTTP; a deploy step, a load
 * balancer or a fleet agent deciding whether to send traffic needs to know
 * whether the instance can reach its data. One `SELECT 1` answers that, on
 * either dialect, inside a fixed budget.
 *
 * The probe never rejects: every failure is an OUTCOME the caller reports —
 * `timeout` when nothing came back in time (a database that hangs, a frozen
 * network path), `error` when the query failed (refused connection, dropped
 * session, broken file). The query a timeout abandons keeps running in the
 * driver until the driver gives up on it; a probe cannot cancel a statement
 * the pool has already sent.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { logError } from '@/infrastructure/logging/logger'
import type { HealthCheckOutcome } from '@/domain/models/api/server/health'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/** The budget the readiness probe gives the database, in milliseconds. */
export const DATABASE_READINESS_BUDGET_MS = 2000

/**
 * Run one `SELECT 1` against `db` within `budgetMs`.
 *
 * A failure is logged with its cause before it is reported as `error`: the
 * probe answers 503 either way, and the log line is the only place the reason
 * survives (standing rule E6).
 */
export const probeDatabaseReadiness = async (
  { client: db, dialect }: DatabaseService,
  budgetMs: number = DATABASE_READINESS_BUDGET_MS
): Promise<HealthCheckOutcome> => {
  const timers = new Map<'timer', ReturnType<typeof setTimeout>>()
  const deadline = new Promise<HealthCheckOutcome>((resolve) => {
    timers.set(
      'timer',
      setTimeout(() => resolve('timeout'), budgetMs)
    )
  })
  const query = executeRawOn(dialect.kind, db, sql`SELECT 1`).then(
    (): HealthCheckOutcome => 'ok',
    (cause: unknown): HealthCheckOutcome => {
      logError('[health] the readiness probe could not query the database', cause)
      return 'error'
    }
  )
  try {
    return await Promise.race([query, deadline])
  } finally {
    clearTimeout(timers.get('timer'))
  }
}

/**
 * {@link probeDatabaseReadiness} against the `Database` service the caller
 * runs on — the server runtime's own, for the readiness route.
 */
export const databaseReadiness = (
  budgetMs: number = DATABASE_READINESS_BUDGET_MS
): Effect.Effect<HealthCheckOutcome, never, Database> =>
  Effect.flatMap(Database, (database) =>
    // effect-promise: total -- `probeDatabaseReadiness` reports a failed or slow query as an outcome (`error`, `timeout`) and never rejects.
    Effect.promise(() => probeDatabaseReadiness(database, budgetMs))
  )
