/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationApprovalDatabaseError,
  AutomationApprovalRepository,
  type AutomationApprovalRow,
} from '@/application/ports/repositories/automations/automation-approval-repository'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { automationApprovalRequests as approvalsPg } from '@/infrastructure/database/drizzle/schema/automation'
import { automationApprovalRequests as approvalsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const automationApprovalRequests = resolveDialectSchema(approvalsPg, approvalsSqlite)

const wrap = makeDbWrap((cause) => new AutomationApprovalDatabaseError({ cause }))

export const AutomationApprovalRepositoryLive = Layer.succeed(AutomationApprovalRepository, {
  findById: (id) =>
    wrap(async (): Promise<AutomationApprovalRow | undefined> => {
      const rows = await db
        .select({
          id: automationApprovalRequests.id,
          runId: automationApprovalRequests.runId,
          stepIndex: automationApprovalRequests.stepIndex,
          status: automationApprovalRequests.status,
        })
        .from(automationApprovalRequests)
        .where(eq(automationApprovalRequests.id, id))
        .limit(1)
      const row = rows[0]
      return row === undefined ? undefined : row
    }),

  updateStatus: ({ id, status }) =>
    wrap(async (): Promise<string | undefined> => {
      const updated = await db
        .update(automationApprovalRequests)
        .set({ status, respondedAt: new Date() })
        .where(eq(automationApprovalRequests.id, id))
        .returning({ status: automationApprovalRequests.status })
      return updated[0]?.status
    }),
})
