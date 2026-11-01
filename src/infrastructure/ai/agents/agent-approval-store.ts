/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory store for AI agent approval requests.
 *
 * Agent approvals are short-lived runtime objects: a request is created when
 * an agent action needs human review, transitions through approve / reject /
 * expire / escalate, and is read back by the approvals API. The authoritative
 * runtime state lives in this module-level map (mirrored to
 * `system.automation_approval_requests` for the DB-readback spec assertions).
 *
 * A module-level singleton mirrors the `webhook-rate-limit` and form-draft
 * patterns already used elsewhere in the codebase. Per-process state is
 * acceptable because each E2E test starts its own server process.
 *
 * Records are treated as immutable: a transition produces a NEW record object
 * that replaces the map entry, never an in-place mutation. `updateApproval`
 * and `refreshApproval` both follow this copy-on-write discipline so the
 * functional-programming ESLint rules are satisfied without suppressions.
 */

import {
  approvalStateAt,
  type ApprovalRecord,
} from '@/domain/models/app/agents/approval-record-service'
import type {
  ActivityEntry,
  AgentActivityEntry,
  ApprovalActivityEntry,
} from '@/application/ports/services/agent-approval-store'

const approvals = new Map<string, ApprovalRecord>()

/**
 * Activity log stored as an insertion-ordered map keyed by entry id. A map
 * (rather than an array) avoids both `functional/no-let` on a reassigned
 * binding and `no-restricted-syntax` on `Array.push`. Carries both approval
 * decisions and agent-action executions (see `ActivityEntry`).
 */
const activityEntries = new Map<string, ActivityEntry>()

/** Register a freshly created approval record. */
export const putApproval = (record: ApprovalRecord): void => {
  approvals.set(record.id, record)
}

/** Resolve a single approval record by id. */
export const getApproval = (id: string): ApprovalRecord | undefined => approvals.get(id)

/** All approvals belonging to a given agent. */
export const listApprovalsForAgent = (agentName: string): ReadonlyArray<ApprovalRecord> =>
  [...approvals.values()].filter((record) => record.agentName === agentName)

/**
 * Replace the stored record with a copy carrying `patch`. Returns the new
 * record. No-op (returns `undefined`) when the id is unknown.
 */
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

/** Append an approval-decision activity entry. */
export const appendActivityEntry = (entry: ApprovalActivityEntry): void => {
  activityEntries.set(entry.id, entry)
}

/** Append an agent-action activity entry. */
export const appendAgentActivityEntry = (entry: AgentActivityEntry): void => {
  activityEntries.set(entry.id, entry)
}

/** Snapshot of all activity entries — approvals and agent actions (insertion order). */
export const listActivityEntries = (): ReadonlyArray<ActivityEntry> => [...activityEntries.values()]

/**
 * Apply lazy expiry / escalation transitions to a record based on wall-clock
 * time, persisting any change to the store. Pure copy-on-write: returns the
 * up-to-date record (the same instance when nothing changed). Called on every
 * read so a polling client always observes a current status without a
 * background timer.
 */
export const refreshApproval = (record: ApprovalRecord): ApprovalRecord => {
  const next = approvalStateAt(record, Date.now())
  if (next.escalated === record.escalated && next.status === record.status) return record
  return updateApproval(record.id, next) ?? record
}
