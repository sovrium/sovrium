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
  /**
   * The persisted `approvers` JSON, raw: `all-admins`, an array of emails and
   * role names, or null (agent rows and requests recorded before the column
   * existed). Read it through `toApproverList`.
   */
  readonly approvers: unknown
}

/**
 * An automation-step approval request as the approvals list reads it: every
 * column the wire row needs, plus the paused run's automation name.
 */
export interface AutomationApprovalListRow {
  readonly id: string
  readonly runId: string
  readonly automationName: string
  readonly status: string
  readonly message: string | null
  readonly approvers: unknown
  readonly createdAt: Date
  readonly expiresAt: Date | null
  readonly respondedAt: Date | null
}

/**
 * Database error for automation-step approval operations.
 */
export class AutomationApprovalDatabaseError extends Data.TaggedError(
  'AutomationApprovalDatabaseError'
)<{
  readonly cause: unknown
}> {}

export class AutomationApprovalRepository extends Context.Service<
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
      /**
       * Who may resolve the request, as rendered for this run. Omitted when
       * the action declared none, which reads as `all-admins`.
       */
      readonly approvers: 'all-admins' | readonly string[] | undefined
    }) => Effect.Effect<void, AutomationApprovalDatabaseError>

    /** Load an approval row by id. Returns `undefined` when no row matches. */
    readonly findById: (
      id: string
    ) => Effect.Effect<AutomationApprovalRow | undefined, AutomationApprovalDatabaseError>

    /**
     * The automation-step requests (rows linked to a run) carrying `status`,
     * newest first. Agent approvals are not included. Filtering by who may
     * resolve each one is the caller's job: the rule needs the app's roles.
     */
    readonly listAutomationStepRequests: (input: {
      readonly status: string
      /** At most this many rows are read, the newest kept. */
      readonly limit: number
    }) => Effect.Effect<readonly AutomationApprovalListRow[], AutomationApprovalDatabaseError>

    /**
     * The id of the pending request a run is paused on, or `undefined` when
     * the run waits on none.
     */
    readonly findPendingIdByRunId: (
      runId: string
    ) => Effect.Effect<string | undefined, AutomationApprovalDatabaseError>

    /**
     * Move a PENDING approval row to `status` (`approved` / `rejected`),
     * stamping `respondedAt`. Returns the new status when the row was pending
     * and is now updated; `undefined` when no pending row matched — an unknown
     * id, or a request another caller resolved first.
     */
    readonly resolvePending: (input: {
      readonly id: string
      readonly status: string
    }) => Effect.Effect<string | undefined, AutomationApprovalDatabaseError>
  }
>()('AutomationApprovalRepository') {}
