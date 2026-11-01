/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Deciding on an agent's pending approval, once `approval-routes.ts` has let
 * the caller through the agent's trigger grant and found the approval pending:
 * the approver needs a session (401) and a role level at least the agent's
 * (404 otherwise). An approved action executes under the AGENT's identity,
 * never the approver's, and every decision is recorded in the activity log.
 */

import { Effect } from 'effect'
import { dispatchAgentAction } from '@/application/use-cases/agents/agent-action-dispatch'
import { resumeApprovedTurn } from '@/application/use-cases/agents/agent-approval-resume'
import { mirrorApprovalUpdate } from '@/application/use-cases/agents/approval'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { ApiErrorCode } from '@/domain/models/api/error'
import { mayApproveOwnRequest } from '@/domain/models/app/agents/agent-gate-validation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { errorBody, notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { resolveRoleLevel } from './agent-roles'
import { approverIdentityOrBlank, mirrorBestEffort, toMirrorRecord } from './approval-mirror'
import { answerApproval } from './approval-presenter'
import { decideApproval, recordApprovalDecision } from './approval-store-access'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type {
  ApprovalRecord,
  ApprovalStatus,
} from '@/domain/models/app/agents/approval-record-service'
import type { Context } from 'hono'

export type Decision = 'approve' | 'reject'

interface DecisionInput {
  readonly app: App | undefined
  readonly agent: Agent
  readonly record: ApprovalRecord
  readonly decision: Decision
}

/**
 * The decision itself, once the caller is inside the trigger grant and the
 * approval is pending: it needs a session (401) and a role level at least the
 * agent's (404 otherwise).
 */
export const decideAsApprover = (
  c: Readonly<Context>,
  { app, agent, record, decision }: DecisionInput
) =>
  Effect.gen(function* () {
    const session = getSessionContext(c as Context)
    const approver = yield* resolveApprover(session?.userId)
    if (!approver) {
      return c.json(
        errorBody({
          error: 'Authentication is required to decide on an approval.',
          code: ApiErrorCode.UNAUTHORIZED,
        }),
        401
      )
    }

    const agentLevel = resolveRoleLevel(app, agent.role)
    const approverLevel = resolveRoleLevel(app, approver.role)
    if (approverLevel < agentLevel) {
      return c.json(
        notFoundBody(
          `Role level ${approverLevel.toString()} is insufficient to decide on an agent with role level ${agentLevel.toString()}.`
        ),
        404
      )
    }

    if (refusesOwnApproval({ app, record, decision, approver })) return ownApprovalRefused(c)

    return yield* applyDecision(c, { record, decision, approver, agent, app })
  })

/**
 * Is this the person who asked for a held side effect, approving it herself?
 * An email, a web request or a file change asked for in a chat is approved by
 * someone else, unless she is admin-equivalent (`mayApproveOwnRequest`). She
 * may always reject it.
 */
export const refusesOwnApproval = (input: {
  readonly app: App | undefined
  readonly record: ApprovalRecord
  readonly decision: Decision
  readonly approver: { readonly id: string; readonly role: string }
}): boolean => {
  const { app, record, decision, approver } = input
  if (decision !== 'approve' || approver.id !== record.requestedById) return false
  const adminEquivalent = app !== undefined && isAdminEquivalent(approver.role, app)
  return !mayApproveOwnRequest(record.action, adminEquivalent)
}

/** The 403 for {@link refusesOwnApproval}: the approval stays pending. */
export const ownApprovalRefused = (c: Readonly<Context>): Response =>
  c.json(
    errorBody({
      error:
        'An email, a web request or a file change you asked an agent for is approved by someone else. You can reject it.',
      code: ApiErrorCode.FORBIDDEN,
    }),
    403
  )

interface Approver {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: string
}

/** Resolve the approving user from the session, including role, name + email. */
const resolveApprover = (userId: string | undefined) =>
  Effect.gen(function* () {
    if (userId === undefined) return undefined
    const role = yield* getUserRole(userId)
    const { email, name } = yield* approverIdentityOrBlank(userId)
    return { id: userId, name, email, role } satisfies Approver
  })

/**
 * Record a decision where every approval decision lands: on the approval
 * itself, its database mirror and the activity feed. An approved action is
 * recorded as executed under the AGENT's identity, never the approver's.
 * Answers the approval as it now reads.
 */
export const recordApprovalOutcome = (input: {
  readonly record: ApprovalRecord
  readonly decision: Decision
  readonly approver: Omit<Approver, 'role'>
}) =>
  Effect.gen(function* () {
    const { record, decision, approver } = input
    const nextStatus: ApprovalStatus = decision === 'approve' ? 'approved' : 'rejected'
    const decided = yield* decideApproval(record.id, {
      status: nextStatus,
      approvedByEmail: approver.email,
      ...(decision === 'approve' && { actionExecuted: true, executedAs: record.agentName }),
    })
    const next = decided ?? record

    yield* mirrorBestEffort(mirrorApprovalUpdate(toMirrorRecord(next)))

    yield* recordApprovalDecision({
      action: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
      approvalId: next.id,
      agentName: next.agentName,
      actor: { id: approver.id, name: approver.name, email: approver.email },
      runStartedById: next.requestedById,
    })
    return next
  })

const applyDecision = (
  c: Readonly<Context>,
  input: {
    readonly record: ApprovalRecord
    readonly decision: Decision
    readonly approver: Approver
    readonly agent: Agent
    readonly app: App | undefined
  }
) =>
  Effect.gen(function* () {
    const { record, decision, approver } = input
    const next = yield* recordApprovalOutcome({ record, decision, approver })
    if (decision === 'approve') yield* resumeTurn(input.agent, input.app, next.id)
    return answerApproval(c, next)
  })

/**
 * Run the approved action and finish the agent turn it paused, under the
 * agent's identity. An approval opened by `/execute` paused no turn and runs
 * nothing here.
 */
const resumeTurn = (agent: Agent, app: App | undefined, approvalId: string) =>
  app === undefined
    ? Effect.void
    : resumeApprovedTurn({
        approvalId,
        agent,
        app,
        runActionFor: (caller) => (action, props) =>
          dispatchAgentAction({ app, agentName: agent.name, action, props, caller }),
      })
