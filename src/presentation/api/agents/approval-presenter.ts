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

import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'

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
