/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Who may read, replay and cancel an automation run.
 *
 * A run carries what started it — a webhook's payload, a form's answers — and
 * what each step produced, so it is read only by:
 *   - an admin (a role equivalent to the app's top role), who reads every run;
 *   - the person who started it by hand (a manual trigger, a record button);
 *   - an approver a request on that run names (`isPersistedApprover`, the rule
 *     the approval endpoints apply), who must read what they are asked to approve.
 *
 * Anyone else is answered as if the run did not exist. Acting on a run (replay,
 * cancel) is NARROWER than reading it: an admin, or the hand-starter who still
 * holds the trigger's role.
 */

import { Effect } from 'effect'
import {
  AutomationApprovalRepository,
  type AutomationApprovalDatabaseError,
  type RunApproversRow,
} from '@/application/ports/repositories/automations/automation-approval-repository'
import {
  AutomationRunRepository,
  type AutomationRunDatabaseError,
  type PersistedRun,
  type RunReaderScope,
} from '@/application/ports/repositories/automations/automation-run-repository'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import {
  isApprovalAdmin,
  isPersistedApprover,
} from '@/domain/models/app/automations/actions/approval/approver-validation'
import type {
  AuthDatabaseError,
  AuthRepository,
} from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/** What one caller may read: every run, or only the runs of a scope. */
export type RunAccess =
  { readonly kind: 'every-run' } | { readonly kind: 'scoped'; readonly scope: RunReaderScope }

type RunAccessError = AuthDatabaseError | AutomationApprovalDatabaseError

/** The run ids among `rows` whose request names the caller an approver. */
const approvedRunIds = (
  rows: readonly RunApproversRow[],
  caller: { readonly userId: string; readonly role: string },
  app: App
): readonly string[] => [
  ...new Set(
    rows.filter((row) => isPersistedApprover(row.approvers, caller, app)).map((row) => row.runId)
  ),
]

/**
 * Resolve what `userId` may read: every run for an admin; otherwise the runs
 * they started by hand plus the runs a request names them an approver of.
 * The run lists pass the scope to the query, so their totals count only these.
 *
 * The approver read is narrowed in the query to the requests whose approvers
 * mention the caller's role or account id — the only two ways a list can name
 * them — so a member's run list does not read the whole approval history. A
 * built-in `admin` below the app's top role is an approver of EVERY request
 * that names `all-admins`, so that caller reads them all, unnarrowed.
 */
export const loadRunAccess = (input: {
  readonly userId: string
  readonly app: App
}): Effect.Effect<RunAccess, RunAccessError, AuthRepository | AutomationApprovalRepository> =>
  Effect.gen(function* () {
    const role = yield* getUserRole(input.userId)
    if (isAdminEquivalent(role, input.app)) return { kind: 'every-run' as const }
    const approvals = yield* AutomationApprovalRepository
    const rows = yield* approvals.listRunApprovers(
      isApprovalAdmin(role, input.app) ? {} : { mentioning: [role, input.userId] }
    )
    return {
      kind: 'scoped' as const,
      scope: {
        userId: input.userId,
        runIds: approvedRunIds(rows, { userId: input.userId, role }, input.app),
      },
    }
  }).pipe(Effect.withSpan('automations.load-run-access'))

/** A run its caller may read, and whether that caller reads every run (an admin). */
export interface ReadableRun {
  readonly run: PersistedRun
  readonly readsEveryRun: boolean
}

/**
 * The run `runId` when `userId` may read it, or `undefined` — for a run that
 * does not exist and for one they may not read alike, so the two answers
 * cannot be told apart.
 *
 * The three reads (the run, the caller's role, the requests on that run) are
 * made whatever the answer, and together: a missing run that answered after
 * one read while a denied one took three would let a stopwatch tell them apart.
 */
export const findReadableRun = (input: {
  readonly runId: string
  readonly userId: string
  readonly app: App
}): Effect.Effect<
  ReadableRun | undefined,
  RunAccessError | AutomationRunDatabaseError,
  AuthRepository | AutomationApprovalRepository | AutomationRunRepository
> =>
  Effect.gen(function* () {
    const runs = yield* AutomationRunRepository
    const approvals = yield* AutomationApprovalRepository
    const [run, role, rows] = yield* Effect.all(
      [
        runs.findById(input.runId),
        getUserRole(input.userId),
        approvals.listRunApprovers({ runId: input.runId }),
      ],
      { concurrency: 3 }
    )
    if (run === undefined) return undefined
    const readsEveryRun = isAdminEquivalent(role, input.app)
    const startedIt = run.startedByHand && run.triggeredByUserId === input.userId
    const named = approvedRunIds(rows, { userId: input.userId, role }, input.app)
    return readsEveryRun || startedIt || named.includes(input.runId)
      ? { run, readsEveryRun }
      : undefined
  }).pipe(Effect.withSpan('automations.find-readable-run'))
