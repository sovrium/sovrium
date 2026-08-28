/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Approval Repository Implementation (Drizzle).
 *
 * Mirrors AI agent approval requests into `system.automation_approval_requests`
 * and resolves the approver's email. The column mapping is preserved verbatim
 * from the former `approval-db.ts` presentation module. The `run_id` column is
 * left null for agent approvals — the automation-approval table was made
 * `run_id`-nullable in migration 0006 to carry both automation-step and
 * agent-action approvals; `step_index` is 0 for agent approvals.
 *
 * Every method surfaces a typed `ApprovalDatabaseError` on failure (via
 * `makeDbWrap`). The best-effort discard-on-error and the `''` email-lookup
 * default live in the route-side runner (`runApprovalMirror`), NOT here, so the
 * port contract stays honest about the possible failure.
 */

import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  ApprovalRepository,
  ApprovalDatabaseError,
} from '@/application/ports/repositories/ai/approval-repository'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { automationApprovalRequests as automationApprovalRequestsPg } from '@/infrastructure/database/drizzle/schema/automation'
import { automationApprovalRequests as automationApprovalRequestsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/**
 * The approval table for the active dialect — `system.automation_approval_requests`
 * on Postgres, the flat `system_automation_approval_requests` on SQLite. The
 * route-side runner discards this repository's failures by design, so a dialect
 * mismatch here leaves the API returning a correct 202 over an empty audit table.
 */
const automationApprovalRequests = resolveDialectSchema(
  automationApprovalRequestsPg,
  automationApprovalRequestsSqlite
)

/** Wrap a DB promise, adapting failures to ApprovalDatabaseError. */
const wrap = makeDbWrap((cause) => new ApprovalDatabaseError({ cause }))

export const ApprovalRepositoryLive = Layer.succeed(ApprovalRepository, {
  insertApprovalRow: (record) =>
    wrap(async () => {
      // `run_id` is null for agent approvals (migration 0006 made it nullable);
      // `step_index` is 0. Column mapping preserved verbatim from approval-db.ts.
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await db.insert(automationApprovalRequests).values({
        id: record.id,
        stepIndex: 0,
        status: record.status,
        agentName: record.agentName,
        actionPayload: record.actionPayload,
        actionExecuted: record.actionExecuted,
        timeoutSeconds: record.timeoutSeconds,
        escalated: record.escalated,
        ...(record.executedAs !== undefined && { executedAs: record.executedAs }),
        ...(record.escalatedTo !== undefined && { escalatedTo: record.escalatedTo }),
        expiresAt: new Date(record.expiresAtMs),
      })
    }),

  updateApprovalRow: (record) =>
    wrap(async () => {
      // eslint-disable-next-line functional/no-expression-statements -- DB side effect
      await db
        .update(automationApprovalRequests)
        .set({
          status: record.status,
          actionExecuted: record.actionExecuted,
          escalated: record.escalated,
          executedAs: record.executedAs ?? undefined,
          escalatedTo: record.escalatedTo ?? undefined,
          respondedAt: new Date(),
        })
        .where(eq(automationApprovalRequests.id, record.id))
    }),

  lookupUserEmail: (userId) =>
    wrap(async () => {
      // Resolve the dialect-correct auth users table per call — `auth.user` on
      // Postgres, `auth_user` on SQLite.
      const users = authUsersTable()
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      return rows[0]?.email ?? ''
    }),
})
