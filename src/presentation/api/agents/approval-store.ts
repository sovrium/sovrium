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

/** Terminal and in-flight approval statuses. */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

/** A single recorded agent action awaiting (or past) approval. */
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

/** An activity-log entry produced by an approval decision. */
export interface ApprovalActivityEntry {
  readonly id: string
  readonly action: 'approval.approved' | 'approval.rejected'
  readonly approvalId: string
  readonly agentName: string
  readonly actor: { readonly id: string; readonly email: string }
  readonly createdAt: string
}

/**
 * An activity-log entry produced by an agent action execution.
 *
 * [internal ref]: an agent action appears in activity
 * monitoring with `actor.type = 'agent'` and `actor.name` set to the agent's
 * configured name, so monitoring can attribute the action to a non-human
 * actor. This is the in-memory counterpart of the `activity_log` table row
 * written by `agent-activity-log.ts`.
 */
export interface AgentActivityEntry {
  readonly id: string
  readonly action: string
  readonly agentName: string
  readonly actor: { readonly type: 'agent'; readonly name: string }
  readonly targetTable: string | undefined
  readonly createdAt: string
}

/**
 * Activity-monitoring entry surfaced by `GET /api/activity` — either an
 * approval decision or an agent action execution.
 */
export type ActivityEntry = ApprovalActivityEntry | AgentActivityEntry

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
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton store; see file docstring
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
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton store; the record value is a fresh immutable object
  approvals.set(id, next)
  return next
}

/** Append an approval-decision activity entry. */
export const appendActivityEntry = (entry: ApprovalActivityEntry): void => {
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton log; see file docstring
  activityEntries.set(entry.id, entry)
}

/** Append an agent-action activity entry. */
export const appendAgentActivityEntry = (entry: AgentActivityEntry): void => {
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- mutable singleton log; see file docstring
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
