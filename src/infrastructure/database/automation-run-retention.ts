/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, inArray, lt, notExists, notInArray, or } from 'drizzle-orm'
import { zonedStartOfDayDaysBefore } from '@/domain/kernel/time/zoned-calendar'
import { parseSovriumAutomationRunRetentionDays } from '@/domain/models/process-env/automations'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationApprovalRequests as approvalsPg,
  automationRuns as runsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationApprovalRequests as approvalsSqlite,
  automationRuns as runsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { logInfo } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'

/**
 * The run-history retention EXECUTOR: `SOVRIUM_AUTOMATION_RUN_RETENTION_DAYS`.
 *
 * Deletes every run that ENDED and was created before the window — midnight,
 * operator timezone, that many days before today — with its steps, references,
 * parked steps and approval requests (all `ON DELETE CASCADE` on the run). A
 * run still queued, running or waiting is never deleted: deleting it would
 * strand an approver or a delayed step. One exception, measured: an approved
 * run resumes as a NEW run row and its paused parent keeps `waiting-approval`
 * for ever, so a `waiting-approval` run whose approval request is no longer
 * pending counts as ended — otherwise every approved run would be kept.
 *
 * Unset, the variable keeps every run: an upgrade must never start deleting
 * history an operator relied on. Batched like the table sweep; the Drizzle
 * builder encodes `created_at` per dialect (`timestamptz` on PostgreSQL, an
 * INTEGER of milliseconds on SQLite).
 */

const automationRuns = resolveDialectSchema(runsPg, runsSqlite)
const automationApprovalRequests = resolveDialectSchema(approvalsPg, approvalsSqlite)

/** Runs one statement deletes. */
const BATCH_SIZE = 500

/** The statuses of a run that has not ended. */
const UNFINISHED_STATUSES = ['pending', 'queued', 'running', 'waiting-approval', 'waiting-delay']

/** A run that ended: a final status, or a paused approval parent whose request was answered. */
const hasEnded = () =>
  or(
    notInArray(automationRuns.status, UNFINISHED_STATUSES),
    and(
      eq(automationRuns.status, 'waiting-approval'),
      notExists(
        db
          .select({ id: automationApprovalRequests.id })
          .from(automationApprovalRequests)
          .where(
            and(
              eq(automationApprovalRequests.runId, automationRuns.id),
              eq(automationApprovalRequests.status, 'pending')
            )
          )
      )
    )
  )

/** Delete the next batch of ended runs created before `cutoff`; answers how many went. */
const deleteBatch = async (cutoff: Readonly<Date>): Promise<number> => {
  const due = await db
    .select({ id: automationRuns.id })
    .from(automationRuns)
    .where(and(lt(automationRuns.createdAt, cutoff), hasEnded()))
    .limit(BATCH_SIZE)
  if (due.length === 0) return 0
  const deleted = await db
    .delete(automationRuns)
    .where(
      inArray(
        automationRuns.id,
        due.map((run) => run.id)
      )
    )
    .returning({ id: automationRuns.id })
  return deleted.length
}

/** Delete batches until one comes back short. */
const deleteAll = async (cutoff: Readonly<Date>, total: number): Promise<number> => {
  const deleted = await deleteBatch(cutoff)
  return deleted < BATCH_SIZE ? total + deleted : deleteAll(cutoff, total + deleted)
}

/**
 * Run the run-history sweep once.
 *
 * @param env - the environment holding the window (validated at boot).
 * @param now - the reference instant, injected so the sweep is testable.
 * @returns the number of runs deleted; `0` when no window is set.
 */
export async function pruneExpiredAutomationRuns(
  env: Readonly<Record<string, string | undefined>> = process.env,
  now: Readonly<Date> = new Date()
): Promise<number> {
  const days = parseSovriumAutomationRunRetentionDays(env)
  if (days === undefined) return 0
  const cutoff = zonedStartOfDayDaysBefore(now, resolveOperatorTimezone(), days)
  const deleted = await deleteAll(cutoff, 0)
  if (deleted > 0) {
    logInfo(
      `[automation-run-retention] Deleted ${String(deleted)} run(s) that ended before ${cutoff.toISOString()}`
    )
  }
  return deleted
}
