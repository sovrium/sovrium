/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation Approval Repository Implementation (Drizzle).
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

import { and, asc, desc, eq, gt, isNotNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  AutomationApprovalDatabaseError,
  AutomationApprovalRepository,
  type AutomationApprovalListRow,
  type AutomationApprovalRow,
  type RunApproversRow,
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

/**
 * The requests whose persisted approvers mention one of `needles` anywhere in
 * their JSON text — bound values, so a role name is data, never SQL. The match
 * only ever WIDENS: `%`/`_` are wildcards, and a `"` or `\\` (which JSON text
 * escapes, and PostgreSQL's LIKE reads as its escape) is matched as a wildcard
 * run. The caller applies the exact approver rule to what comes back.
 * No needle list: no narrowing.
 */
const mentioningFilter = (needles: readonly string[] | undefined): readonly SQL[] =>
  needles === undefined
    ? []
    : [
        or(
          ...needles.map(
            (needle) =>
              sql`CAST(${automationApprovalRequests.approvers} AS TEXT) LIKE ${`%${needle.split(/["\\]/).join('%')}%`}`
          )
        ) ?? sql`1 = 0`,
      ]

/** The columns an {@link AutomationApprovalRow} projects. */
const approvalRowColumns = {
  id: automationApprovalRequests.id,
  runId: automationApprovalRequests.runId,
  stepIndex: automationApprovalRequests.stepIndex,
  status: automationApprovalRequests.status,
  approvers: automationApprovalRequests.approvers,
  expiresAt: automationApprovalRequests.expiresAt,
}

/**
 * The rows the timeout sweep reads: automation-step requests still `pending`
 * whose deadline is at or before `now` — and, when `after` is given, only those
 * past it in `(expiresAt, id)` order. The cursor is what lets a sweep read past
 * a request it leaves open (`onTimeout: escalate`, no `onTimeout`, an
 * automation since removed from the config): without it those rows, being the
 * oldest, would hold the head of every page forever and starve the requests
 * behind them.
 */
export const expiredPendingCondition = (input: {
  readonly now: Date
  readonly after?: { readonly expiresAt: Date; readonly id: string }
}) =>
  and(
    eq(automationApprovalRequests.status, 'pending'),
    isNotNull(automationApprovalRequests.runId),
    lte(automationApprovalRequests.expiresAt, input.now),
    input.after === undefined
      ? undefined
      : or(
          gt(automationApprovalRequests.expiresAt, input.after.expiresAt),
          and(
            eq(automationApprovalRequests.expiresAt, input.after.expiresAt),
            gt(automationApprovalRequests.id, input.after.id)
          )
        )
  )

/**
 * The claim's guard: the row, and only while it is still `pending`. The
 * UPDATE that carries it is one statement, so the database decides the race —
 * PostgreSQL re-checks the predicate against the row version it locked, SQLite
 * serialises writers — and of two resolutions of one request, from one server
 * or two sharing a database, exactly one matches.
 */
export const pendingClaimCondition = (id: string) =>
  and(eq(automationApprovalRequests.id, id), eq(automationApprovalRequests.status, 'pending'))

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
        .select(approvalRowColumns)
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
          stepIndex: automationApprovalRequests.stepIndex,
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

  listRunApprovers: ({ runId, mentioning }) =>
    wrap(async (): Promise<readonly RunApproversRow[]> => {
      const rows = await db
        .select({
          runId: automationApprovalRequests.runId,
          approvers: automationApprovalRequests.approvers,
        })
        .from(automationApprovalRequests)
        .where(
          and(
            runId === undefined
              ? isNotNull(automationApprovalRequests.runId)
              : eq(automationApprovalRequests.runId, runId),
            ...mentioningFilter(mentioning)
          )
        )
      return rows.flatMap((row) =>
        row.runId === null ? [] : [{ runId: row.runId, approvers: row.approvers }]
      )
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

  // The status index narrows to the pending rows; the deadline filters those.
  listExpiredPending: ({ now, limit, after }) =>
    wrap(async (): Promise<readonly AutomationApprovalRow[]> =>
      db
        .select(approvalRowColumns)
        .from(automationApprovalRequests)
        .where(expiredPendingCondition({ now, ...(after === undefined ? {} : { after }) }))
        .orderBy(asc(automationApprovalRequests.expiresAt), asc(automationApprovalRequests.id))
        .limit(limit)
    ),

  // Compare-and-set on `pending` (`pendingClaimCondition`): of two concurrent
  // resolutions of one request, exactly one updates the row. The other reads
  // `undefined` and is refused, so an approval can never resume its run twice.
  resolvePending: ({ id, status, approvedById }) =>
    wrap(async (): Promise<string | undefined> => {
      const updated = await db
        .update(automationApprovalRequests)
        .set({
          status,
          respondedAt: new Date(),
          ...(approvedById === undefined ? {} : { approvedById }),
        })
        .where(pendingClaimCondition(id))
        .returning({ status: automationApprovalRequests.status })
      return updated[0]?.status
    }),
})
