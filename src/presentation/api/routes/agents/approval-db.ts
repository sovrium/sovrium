/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { users } from '@/infrastructure/database/drizzle/schema'
import { automationApprovalRequests } from '@/infrastructure/database/drizzle/schema/automation'
import type { ApprovalRecord } from './approval-store'

export const insertApprovalRow = async (record: ApprovalRecord): Promise<void> => {
  await db
    .insert(automationApprovalRequests)
    .values({
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
    .catch(() => undefined)
}

export const updateApprovalRow = async (record: ApprovalRecord): Promise<void> => {
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
    .catch(() => undefined)
}

export const lookupUserEmail = async (userId: string): Promise<string> => {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .catch(() => [])
  return rows[0]?.email ?? ''
}
