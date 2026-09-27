/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation Approval Repository Implementation (Drizzle) — [internal ref].
 *
 * Owns the `system.automation_approval_requests` table for automation-step
 * approvals: insert a `pending` row (`approval/request` action handler), load a
 * pending row by id, and mark it `approved` / `rejected` (run-scoped resolution
 * endpoint).
 *
 * Dialect-resolved (`resolveDialectSchema`) so both Postgres and SQLite share
 * the same query path. Every method surfaces a typed
 * `AutomationApprovalDatabaseError` on failure (via `makeDbWrap`).
 */

import { and, desc, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AutomationApprovalDatabaseError,
  AutomationApprovalRepository,
  type AutomationApprovalListRow,
  type AutomationApprovalRow,
} from '@/application/ports/repositories/automations/automation-approval-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationApprovalRequests as approvalsPg,
  automationDefinitions as definitionsPg,
  automationRuns as runsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationApprovalRequests as approvalsSqlite,
  automationDefinitions as definitionsSqlite,
  automationRuns as runsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const automationApprovalRequests = resolveDialectSchema(approvalsPg, approvalsSqlite)
const automationRuns = resolveDialectSchema(runsPg, runsSqlite)
const automationDefinitions = resolveDialectSchema(definitionsPg, definitionsSqlite)

/** Wrap a DB promise, adapting failures to AutomationApprovalDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationApprovalDatabaseError({ cause }))

export const AutomationApprovalRepositoryLive = Layer.succeed(AutomationApprovalRepository, {
  insertPending: ({ message, stepIndex, runId, timeoutSeconds, expiresAt, approvers }) =>
    wrap(() =>
      db.insert(automationApprovalRequests).values({
        stepIndex,
        status: 'pending',
        message,
        ...(approvers !== undefined ? { approvers } : {}),
        ...(runId !== undefined ? { runId } : {}),
        ...(timeoutSeconds !== undefined ? { timeoutSeconds } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      })
    ).pipe(Effect.asVoid),

  findById: (id) =>
    wrap(async (): Promise<AutomationApprovalRow | undefined> => {
      const rows = await db
        .select({
          id: automationApprovalRequests.id,
          runId: automationApprovalRequests.runId,
          stepIndex: automationApprovalRequests.stepIndex,
          status: automationApprovalRequests.status,
          approvers: automationApprovalRequests.approvers,
        })
        .from(automationApprovalRequests)
        .where(eq(automationApprovalRequests.id, id))
        .limit(1)
      const row = rows[0]
      return row === undefined ? undefined : row
    }),

  // An INNER join on the run is what keeps agent approvals (no run) out, and
  // it names each row's automation from its definition in the same read.
  listAutomationStepRequests: ({ status, limit }) =>
    wrap(async (): Promise<readonly AutomationApprovalListRow[]> => {
      const rows = await db
        .select({
          id: automationApprovalRequests.id,
          runId: automationRuns.id,
          automationName: automationDefinitions.name,
          status: automationApprovalRequests.status,
          message: automationApprovalRequests.message,
          approvers: automationApprovalRequests.approvers,
          createdAt: automationApprovalRequests.createdAt,
          expiresAt: automationApprovalRequests.expiresAt,
          respondedAt: automationApprovalRequests.respondedAt,
        })
        .from(automationApprovalRequests)
        .innerJoin(automationRuns, eq(automationRuns.id, automationApprovalRequests.runId))
        .innerJoin(automationDefinitions, eq(automationDefinitions.id, automationRuns.automationId))
        .where(eq(automationApprovalRequests.status, status))
        .orderBy(desc(automationApprovalRequests.createdAt), desc(automationApprovalRequests.id))
        .limit(limit)
      return rows
    }),

  findPendingIdByRunId: (runId) =>
    wrap(async (): Promise<string | undefined> => {
      const rows = await db
        .select({ id: automationApprovalRequests.id })
        .from(automationApprovalRequests)
        .where(
          and(
            eq(automationApprovalRequests.runId, runId),
            eq(automationApprovalRequests.status, 'pending')
          )
        )
        .orderBy(desc(automationApprovalRequests.createdAt))
        .limit(1)
      return rows[0]?.id
    }),

  // Compare-and-set on `pending`: of two concurrent resolutions of one
  // request, exactly one updates the row. The other reads `undefined` and is
  // refused, so an approval can never resume its run twice.
  resolvePending: ({ id, status }) =>
    wrap(async (): Promise<string | undefined> => {
      const updated = await db
        .update(automationApprovalRequests)
        .set({ status, respondedAt: new Date() })
        .where(
          and(
            eq(automationApprovalRequests.id, id),
            eq(automationApprovalRequests.status, 'pending')
          )
        )
        .returning({ status: automationApprovalRequests.status })
      return updated[0]?.status
    }),
})
