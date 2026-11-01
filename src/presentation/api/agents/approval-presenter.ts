/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Serialization of AI agent approval records: `serializeApproval` shapes a
 * record into the JSON contract read by the approvals API. A record is built
 * by the domain (`approval-record-service.ts`).
 */

import {
  agentApprovalListResponseSchema,
  executeResultSchema,
  serializedApprovalSchema,
} from '@/domain/models/api/agents/agents'
import { shapedJson } from '@/presentation/api/runtime/run-effect'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import type { Context } from 'hono'

/** Serialize an approval record for API responses. */
export const serializeApproval = (record: ApprovalRecord): Record<string, unknown> => ({
  approvalId: record.id,
  id: record.id,
  agent: record.agentName,
  action: record.action,
  status: record.status,
  timeout: record.timeoutSeconds,
  actionExecuted: record.actionExecuted,
  executedAs: record.executedAs,
  escalated: record.escalated,
  escalatedTo: record.escalated ? record.escalatedTo : undefined,
  createdAt: new Date(record.createdAtMs).toISOString(),
  expiresAt: new Date(record.expiresAtMs).toISOString(),
})

/** Answer one approval. */
export const answerApproval = (c: Context, record: ApprovalRecord): Response =>
  shapedJson(c, serializeApproval(record), serializedApprovalSchema)

/** Answer a list of approvals. */
export const answerApprovals = (c: Context, records: readonly ApprovalRecord[]): Response =>
  shapedJson(c, { approvals: records.map(serializeApproval) }, agentApprovalListResponseSchema)

/** Answer an action that ran without waiting for anyone. */
export const answerCompleted = (c: Context, agent: string): Response =>
  shapedJson(c, { status: 'completed', approvalRequired: false, agent }, executeResultSchema)

/** Answer an action held for approval. */
export const answerPendingApproval = (c: Context, approvalId: string, agent: string): Response =>
  shapedJson(
    c,
    { status: 'pending_approval', approvalRequired: true, approvalId, agent },
    executeResultSchema,
    202
  )
