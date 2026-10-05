/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One-time scrub, at the first start after the upgrade, of the automation runs
 * recorded before runs kept the records they read.
 *
 * Erasing an account scrubs exactly the runs whose refs name one of the
 * person's records (`account-purge-runs.ts`). A run recorded before the refs
 * existed has none, so no erasure could ever reach it: it would keep, for
 * good, whatever record of a person it captured. The upgrade therefore scrubs
 * every such run that read stored records — its trigger captured a record,
 * another run handed it its trigger data, or a step read the app's data
 * (`readStoredRecords`) — exactly as an erasure would: values emptied, steps,
 * statuses and timings kept, `values_erased_at` set, its operator-search row
 * dropped. A run that read nothing stored (a webhook relayed to an email) is
 * left as it was.
 *
 * Which runs predate the refs is marked by the migration that created them:
 * one ref with an empty table name per run that existed then. This pass
 * consumes those markers in batches, each batch in one transaction, so it is
 * idempotent and resumes where a crash left it. A run that has not ended — one
 * waiting for an approval resumes from its trigger data — keeps its marker and
 * is settled on the first start after it ends. Not a SQL migration because
 * which steps read stored records is a question of the config.
 *
 * Log-and-continue: a failure leaves the remaining markers for the next start.
 */

import { sql } from 'drizzle-orm'
import { readStoredRecords } from '@/domain/models/app/automations/run-record-refs-service'
import { db } from '@/infrastructure/database'
import { logError, logInfo } from '@/infrastructure/logging/logger'
import { scrubRuns } from './account-purge-runs'
import { executeRaw } from './sql/dialect-execute'
import { systemTableRef } from './sql/dialect-sql'
import type { App } from '@/domain/models/app'
import type { DrizzleDB, DrizzleTransaction } from '@/infrastructure/database'

/** How many marked runs one batch reads and settles. */
const BATCH = 200

/** A run recorded before the refs, as the predicate reads it. */
interface LegacyRun {
  readonly id: string
  readonly automationName: string
  readonly triggerData: unknown
  readonly steps: readonly {
    readonly name: string
    readonly status: string
    readonly output: unknown
  }[]
}

/** A JSON column as stored: parsed on SQLite, where it is text. */
const parsedJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/**
 * The statuses of a run that has not ended. Such a run still needs its trigger
 * data — a run waiting for an approval resumes from it — so it keeps its
 * marker and is settled on a later start, once it has ended.
 */
const UNFINISHED_STATUSES = ['queued', 'running', 'waiting-approval'] as const

/** The next batch of ended runs still marked as recorded before the refs. */
const markedRuns = async (database: Readonly<DrizzleDB>): Promise<readonly LegacyRun[]> => {
  const unfinished = sql.join(
    UNFINISHED_STATUSES.map((status) => sql`${status}`),
    sql`, `
  )
  const runs = await executeRaw(
    database,
    sql`SELECT r.id AS id, d.name AS automation_name, r.trigger_data AS trigger_data
        FROM ${systemTableRef('automation_run_refs')} AS m
        INNER JOIN ${systemTableRef('automation_runs')} AS r ON r.id = m.run_id
        LEFT JOIN ${systemTableRef('automation_definitions')} AS d ON d.id = r.automation_id
        WHERE m.table_name = '' AND r.status NOT IN (${unfinished})
        LIMIT ${BATCH}`
  )
  return Promise.all(
    runs.map(async (run) => {
      const steps = await executeRaw(
        database,
        sql`SELECT action_name, status, output FROM ${systemTableRef('automation_run_steps')}
            WHERE run_id = ${String(run['id'])} ORDER BY step_index`
      )
      return {
        id: String(run['id']),
        automationName: typeof run['automation_name'] === 'string' ? run['automation_name'] : '',
        triggerData: parsedJson(run['trigger_data']),
        steps: steps.map((step) => ({
          name: String(step['action_name']),
          status: String(step['status']),
          output: parsedJson(step['output']),
        })),
      }
    })
  )
}

/** Scrub the runs of one batch that read stored records, and drop the batch's markers. */
const settleBatch = async (
  tx: Readonly<DrizzleTransaction>,
  app: App,
  batch: readonly LegacyRun[]
): Promise<number> => {
  const toScrub = batch.filter((run) => readStoredRecords({ app, ...run })).map((run) => run.id)
  const scrubbed = await scrubRuns(tx, toScrub)
  const ids = sql.join(
    batch.map((run) => sql`${run.id}`),
    sql`, `
  )
  // eslint-disable-next-line functional/no-expression-statements -- DB side effect
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('automation_run_refs')} WHERE table_name = '' AND run_id IN (${ids})`
  )
  return scrubbed
}

/** Settle every marked run, batch after batch. Returns how many were scrubbed. */
const settleAll = async (
  database: Readonly<DrizzleDB>,
  app: App,
  sofar: number
): Promise<number> => {
  const batch = await markedRuns(database)
  if (batch.length === 0) return sofar
  const scrubbed = await database.transaction((tx) => settleBatch(tx, app, batch))
  return settleAll(database, app, sofar + scrubbed)
}

/**
 * Scrub, once, every run recorded before runs kept refs that read stored
 * records (see the module header). Returns how many runs were scrubbed.
 */
export const scrubLegacyRuns = (app: App, database: Readonly<DrizzleDB> = db): Promise<number> =>
  settleAll(database, app, 0)

/**
 * The boot step: {@link scrubLegacyRuns}, logged, never failing the start. A
 * failure leaves the remaining markers for the next start to settle.
 */
export const runLegacyRunScrub = async (app: App): Promise<void> => {
  try {
    const scrubbed = await scrubLegacyRuns(app)
    if (scrubbed > 0) {
      logInfo(
        `[legacy-run-scrub] emptied the values of ${String(scrubbed)} automation run(s) recorded before runs kept the records they read`
      )
    }
  } catch (error) {
    logError('[legacy-run-scrub] scrubbing pre-upgrade automation runs failed (non-fatal)', error)
  }
}
