/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The approvals list and the caller it is filtered for.
 *
 * `GET /api/automations/approvals` answers only the automation-step requests
 * the signed-in caller may resolve — the same rule the resolution endpoint
 * enforces — so a page bound to it shows each person their own inbox. The
 * caller is loaded once per request: the email for list entries naming an
 * address, the role for `all-admins` and for entries naming a role.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import {
  AutomationApprovalRepository,
  type AutomationApprovalDatabaseError,
  type AutomationApprovalListRow,
} from '@/application/ports/repositories/automations/automation-approval-repository'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  isNamedApprover,
  toApproverList,
  type ApprovalCaller,
} from '@/domain/models/app/automations/actions/approval/approver-validation'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/**
 * Load who a signed-in user is, for the approver rule: their account email and
 * their global role (`member` when the account carries none).
 */
export const loadApprovalCaller = (
  userId: string
): Effect.Effect<ApprovalCaller, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const email = yield* repo.findUserEmailById(userId)
    const role = yield* getUserRole(userId)
    return { email, role }
  }).pipe(Effect.withSpan('automations.load-approval-caller'))

/** A status the approvals list can be asked for. */
type ListedApprovalStatus = 'pending' | 'approved' | 'rejected'

/** A listed request, its status narrowed to the one the list was asked for. */
export type ListedApproval = Omit<AutomationApprovalListRow, 'status'> & {
  readonly status: ListedApprovalStatus
}

/**
 * How many requests of one status are read, newest first, before the caller
 * filter runs. Pending requests are few by nature; the bound is what keeps the
 * approved and rejected history — which only ever grows — from being read in
 * full on every call. A request past it is still resolvable by its ids.
 */
const MAX_LISTED_APPROVALS = 500

/**
 * The automation-step requests carrying `status` that `caller` may resolve,
 * newest first, among the {@link MAX_LISTED_APPROVALS} newest of that status.
 *
 * The filter is `isNamedApprover`, the predicate the resolution gate applies,
 * so the list never offers a request its reader would be refused.
 */
export const listAutomationApprovals = (input: {
  readonly status: ListedApprovalStatus
  readonly caller: ApprovalCaller
  readonly app: App
}): Effect.Effect<
  readonly ListedApproval[],
  AutomationApprovalDatabaseError,
  AutomationApprovalRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AutomationApprovalRepository
    const rows = yield* repo.listAutomationStepRequests({
      status: input.status,
      limit: MAX_LISTED_APPROVALS,
    })
    return rows
      .filter(
        (row) =>
          row.status === input.status &&
          isNamedApprover(toApproverList(row.approvers), input.caller, input.app)
      )
      .map((row) => ({ ...row, status: input.status }))
  }).pipe(Effect.withSpan('automations.list-automation-approvals'))

/**
 * The id of the pending request a run is paused on, or `undefined` when it
 * waits on none. Read by the run detail so a client can resolve it.
 */
export const findPendingApprovalId = (
  runId: string
): Effect.Effect<
  string | undefined,
  AutomationApprovalDatabaseError,
  AutomationApprovalRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AutomationApprovalRepository
    return yield* repo.findPendingIdByRunId(runId)
  }).pipe(Effect.withSpan('automations.find-pending-approval-id'))
