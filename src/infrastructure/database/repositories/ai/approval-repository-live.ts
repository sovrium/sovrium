/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  ApprovalRepository,
  ApprovalDatabaseError,
} from '@/application/ports/repositories/ai/approval-repository'
import { db } from '@/infrastructure/database'
import { users } from '@/infrastructure/database/drizzle/schema'
import { automationApprovalRequests } from '@/infrastructure/database/drizzle/schema/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new ApprovalDatabaseError({ cause }))

export const ApprovalRepositoryLive = Layer.succeed(ApprovalRepository, {
  insertApprovalRow: (record) =>
    wrap(async () => {
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
      const rows = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      return rows[0]?.email ?? ''
    }),
})
