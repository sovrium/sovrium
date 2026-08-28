/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Approval Repository Port
 *
 * Database mirror for AI agent approval requests. The authoritative runtime
 * state for agent approvals lives in the presentation in-memory store
 * (`approval-store.ts`); this port mirrors a subset of that state into
 * `system.automation_approval_requests` so DB-readback spec assertions
 * (e.g. `SELECT status FROM system.automation_approval_requests`) observe the
 * row. It also owns the agent runtime's single read-side query — the
 * approver's email lookup.
 *
 * The mirror writes are best-effort: a DB failure must never break the agent
 * runtime. The repository surfaces a typed {@link ApprovalDatabaseError} on
 * failure; the discard-on-error policy is applied by the route-side runner
 * (`runApprovalMirror`), so this port stays a clean, honest contract.
 *
 * {@link ApprovalMirrorRecord} is a port-level input type carrying exactly the
 * fields a DB write needs. It is deliberately decoupled from the presentation
 * `ApprovalRecord` (which carries extra runtime-only fields), so the
 * application layer never depends on a presentation type — the route maps its
 * `ApprovalRecord` onto this shape.
 *
 * Implementation lives in the infrastructure layer
 * (approval-repository-live.ts).
 */

/**
 * Port-level input for a mirror insert/update — exactly the columns the
 * `system.automation_approval_requests` write touches. `executedAs` /
 * `escalatedTo` are `undefined` when unset (omitted from the write); the
 * `run_id` column is always null for agent approvals (made nullable in
 * migration 0006).
 */
export interface ApprovalMirrorRecord {
  readonly id: string
  readonly status: string
  readonly agentName: string
  readonly actionPayload: Readonly<Record<string, unknown>>
  readonly actionExecuted: boolean
  readonly timeoutSeconds: number
  readonly escalated: boolean
  readonly executedAs: string | undefined
  readonly escalatedTo: string | undefined
  readonly expiresAtMs: number
}

/**
 * Database error for agent-approval mirror operations.
 */
export class ApprovalDatabaseError extends Data.TaggedError('ApprovalDatabaseError')<{
  readonly cause: unknown
}> {}

export class ApprovalRepository extends Context.Service<
  ApprovalRepository,
  {
    /** Insert a new agent-approval mirror row. */
    readonly insertApprovalRow: (
      record: ApprovalMirrorRecord
    ) => Effect.Effect<void, ApprovalDatabaseError>

    /** Update an existing agent-approval mirror row from the runtime record. */
    readonly updateApprovalRow: (
      record: ApprovalMirrorRecord
    ) => Effect.Effect<void, ApprovalDatabaseError>

    /**
     * Look up a user's email address by id. Returns `''` when the id has no
     * matching row (the read-side default for a missing/unreadable user).
     */
    readonly lookupUserEmail: (userId: string) => Effect.Effect<string, ApprovalDatabaseError>
  }
>()('ApprovalRepository') {}
