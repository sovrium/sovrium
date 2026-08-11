/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Automation Approval Repository Port.
 *
 * Read/resolve side of the `system.automation_approval_requests` table for
 * AUTOMATION-STEP approvals — distinct from the agent-mirror `ApprovalRepository`
 * (which only writes agent rows). The run-scoped resolution endpoint
 * (`POST /api/automations/runs/:runId/approvals/:approvalId/approve|reject`)
 * uses this port to:
 *
 *   1. load a pending approval row by id (to verify its `runId`/`stepIndex`
 *      and that it is still `pending`), and
 *   2. mark it `approved` / `rejected` so a second resolution is a no-op.
 *
 * The automation-step INSERT (`insertPending`) is owned by this port too, so the
 * `approval/request` action handler no longer holds a live Drizzle handle.
 *
 * Implementation lives in the infrastructure layer
 * (`automation-approval-repository-live.ts`).
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * A pending/resolved automation-step approval row, projected to exactly the
 * columns the resolution endpoint reads. `runId` links the row to the paused
 * run; `stepIndex` is the 0-indexed position of the approval action that
 * paused it (the resume re-runs every action AFTER this index).
 */
export interface AutomationApprovalRow {
  readonly id: string
  readonly runId: string | null
  readonly stepIndex: number
  readonly status: string
}

/**
 * Database error for automation-step approval operations.
 */
export class AutomationApprovalDatabaseError extends Data.TaggedError(
  'AutomationApprovalDatabaseError'
)<{
  readonly cause: unknown
}> {}

export class AutomationApprovalRepository extends Context.Tag('AutomationApprovalRepository')<
  AutomationApprovalRepository,
  {
    /**
     * Insert a `pending` approval row for an automation step.
     *
     * `runId` links the pending row to the paused run so
     * the run-scoped resolution endpoint can locate and resume it; it is omitted
     * (column left null) when no run row was persisted, as for agent rows.
     * `timeoutSeconds` / `expiresAt` are likewise omitted when the action
     * declared no parseable timeout.
     */
    readonly insertPending: (input: {
      readonly message: string
      readonly stepIndex: number
      readonly runId: string | undefined
      readonly timeoutSeconds: number | undefined
      readonly expiresAt: Date | undefined
    }) => Effect.Effect<void, AutomationApprovalDatabaseError>

    /** Load an approval row by id. Returns `undefined` when no row matches. */
    readonly findById: (
      id: string
    ) => Effect.Effect<AutomationApprovalRow | undefined, AutomationApprovalDatabaseError>

    /**
     * Update the `status` of an approval row (e.g. `approved` / `rejected`),
     * stamping `respondedAt`. Returns the new status when a row was updated,
     * `undefined` when no row matched the id.
     */
    readonly updateStatus: (input: {
      readonly id: string
      readonly status: string
    }) => Effect.Effect<string | undefined, AutomationApprovalDatabaseError>
  }
>() {}
