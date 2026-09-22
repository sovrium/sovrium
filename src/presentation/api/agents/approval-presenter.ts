/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Construction and serialization helpers for AI agent approval records.
 *
 * `buildApprovalRecord` materializes a fresh {@link ApprovalRecord} from an
 * agent + action + payload; `serializeApproval` shapes a record into the JSON
 * contract read by the approvals API. Kept separate from the route handlers
 * so the route module stays focused on request orchestration.
 */

import type { ApprovalRecord } from './approval-store'
import type { Agent } from '@/domain/models/app/agents/agent'

/** Default approval timeout (seconds) — mirrors the schema default. */
export const DEFAULT_TIMEOUT_SECONDS = 3600

/**
 * Materialize a fresh pending approval record for an agent action.
 *
 * Timeout / escalation deadlines are computed from `now` so a polling client
 * sees consistent absolute timestamps without a background timer.
 */
export const buildApprovalRecord = (
  agent: Agent,
  action: string,
  payload: Readonly<Record<string, unknown>>
): ApprovalRecord => {
  const now = Date.now()
  const timeoutSeconds = agent.approval?.timeout ?? DEFAULT_TIMEOUT_SECONDS
  const escalateAfter = agent.approval?.escalation?.after
  return {
    id: crypto.randomUUID(),
    agentName: agent.name,
    agentRole: agent.role,
    action,
    actionPayload: payload,
    status: 'pending',
    timeoutSeconds,
    createdAtMs: now,
    expiresAtMs: now + timeoutSeconds * 1000,
    actionExecuted: false,
    executedAs: undefined,
    escalated: false,
    escalatedTo: agent.approval?.escalation?.to,
    escalateAfterMs: escalateAfter === undefined ? undefined : now + escalateAfter * 1000,
    approvedByEmail: undefined,
  }
}

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
