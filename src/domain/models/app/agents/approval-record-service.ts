/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A pending human approval of one agent action, and the rules of its life.
 *
 * An approval is opened for ONE tool call the agent's approval rule covers
 * (`record.create`), on whatever surface the agent ran; it expires after the
 * agent's `approval.timeout`, and escalates after `approval.escalation.after`
 * while still pending. These are the pure halves: building a record, and
 * deciding its status at an instant. Where records are kept is process state.
 */

import type { Agent } from './agent'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface ApprovalRecord {
  readonly id: string
  readonly agentName: string
  readonly agentRole: string
  readonly action: string
  readonly actionPayload: Readonly<Record<string, unknown>>
  readonly status: ApprovalStatus
  readonly timeoutSeconds: number
  readonly createdAtMs: number
  readonly expiresAtMs: number
  readonly actionExecuted: boolean
  readonly executedAs: string | undefined
  readonly escalated: boolean
  readonly escalatedTo: string | undefined
  readonly escalateAfterMs: number | undefined
  readonly approvedByEmail: string | undefined
  /**
   * The user who started the run that opened this request — the one non-admin
   * besides its approver who reads its decision in the activity feed.
   * `undefined` for a run nobody started (a schedule, an automation).
   */
  readonly requestedById: string | undefined
}

/** Default approval timeout when the agent declares none (seconds). */
export const DEFAULT_APPROVAL_TIMEOUT_SECONDS = 3600

/** A new pending approval of `action`, opened at `nowMs`. */
export const buildApprovalRecord = (input: {
  readonly id: string
  readonly nowMs: number
  readonly agent: Agent
  readonly action: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly requestedById: string | undefined
}): ApprovalRecord => {
  const { agent, nowMs } = input
  const timeoutSeconds = agent.approval?.timeout ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS
  const escalateAfter = agent.approval?.escalation?.after
  return {
    id: input.id,
    agentName: agent.name,
    agentRole: agent.role,
    action: input.action,
    actionPayload: input.payload,
    status: 'pending',
    timeoutSeconds,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + timeoutSeconds * 1000,
    actionExecuted: false,
    executedAs: undefined,
    escalated: false,
    escalatedTo: agent.approval?.escalation?.to,
    escalateAfterMs: escalateAfter === undefined ? undefined : nowMs + escalateAfter * 1000,
    approvedByEmail: undefined,
    requestedById: input.requestedById,
  }
}

/**
 * The status and escalation of a record at `nowMs`: a pending request past its
 * deadline has expired, and one past its escalation instant has escalated.
 */
export const approvalStateAt = (
  record: ApprovalRecord,
  nowMs: number
): Pick<ApprovalRecord, 'status' | 'escalated'> => ({
  escalated:
    record.status === 'pending' &&
    record.escalateAfterMs !== undefined &&
    nowMs >= record.escalateAfterMs
      ? true
      : record.escalated,
  status: record.status === 'pending' && nowMs >= record.expiresAtMs ? 'expired' : record.status,
})
