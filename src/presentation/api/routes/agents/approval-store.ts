/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


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
}

export interface ApprovalActivityEntry {
  readonly id: string
  readonly action: 'approval.approved' | 'approval.rejected'
  readonly approvalId: string
  readonly agentName: string
  readonly actor: { readonly id: string; readonly email: string }
  readonly createdAt: string
}

export interface AgentActivityEntry {
  readonly id: string
  readonly action: string
  readonly agentName: string
  readonly actor: { readonly type: 'agent'; readonly name: string }
  readonly targetTable: string | undefined
  readonly createdAt: string
}

export type ActivityEntry = ApprovalActivityEntry | AgentActivityEntry

const approvals = new Map<string, ApprovalRecord>()

const activityEntries = new Map<string, ActivityEntry>()

export const putApproval = (record: ApprovalRecord): void => {
  approvals.set(record.id, record)
}

export const getApproval = (id: string): ApprovalRecord | undefined => approvals.get(id)

export const listApprovalsForAgent = (agentName: string): ReadonlyArray<ApprovalRecord> =>
  [...approvals.values()].filter((record) => record.agentName === agentName)

export const updateApproval = (
  id: string,
  patch: Partial<ApprovalRecord>
): ApprovalRecord | undefined => {
  const current = approvals.get(id)
  if (!current) return undefined
  const next: ApprovalRecord = { ...current, ...patch }
  approvals.set(id, next)
  return next
}

export const appendActivityEntry = (entry: ApprovalActivityEntry): void => {
  activityEntries.set(entry.id, entry)
}

export const appendAgentActivityEntry = (entry: AgentActivityEntry): void => {
  activityEntries.set(entry.id, entry)
}

export const listActivityEntries = (): ReadonlyArray<ActivityEntry> => [...activityEntries.values()]

export const refreshApproval = (record: ApprovalRecord): ApprovalRecord => {
  const now = Date.now()

  const escalated =
    record.status === 'pending' &&
    record.escalateAfterMs !== undefined &&
    now >= record.escalateAfterMs
      ? true
      : record.escalated

  const status: ApprovalStatus =
    record.status === 'pending' && now >= record.expiresAtMs ? 'expired' : record.status

  if (escalated === record.escalated && status === record.status) return record

  return updateApproval(record.id, { escalated, status }) ?? record
}
