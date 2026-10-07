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

import { MirrorApprovalUpdate } from '@/application/use-cases/agents/approval'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { requireDomainContext, runDomainPromise } from '@/infrastructure/logging/request-effect'
import { errorBody, notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { resolveRoleLevel } from './agent-roles'
import { runApprovalMirror, runApproverIdentityLookup, toMirrorRecord } from './approval-mirror'
import { serializeApproval } from './approval-presenter'
import {
  appendActivityEntry,
  updateApproval,
  type ApprovalRecord,
  type ApprovalStatus,
} from './approval-store'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
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
export const decideAsApprover = async (
  c: Readonly<Context>,
  { app, agent, record, decision }: DecisionInput
): Promise<Response> => {
  const session = getSessionContext(c as Context)
  const approver = await resolveApprover(c as Context, session?.userId)
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

  return applyDecision(c, record, decision, approver)
}

interface Approver {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly role: string
}

/** Resolve the approving user from the session, including role, name + email. */
const resolveApprover = async (
  c: Context,
  userId: string | undefined
): Promise<Approver | undefined> => {
  if (userId === undefined) return undefined
  const role = await runDomainPromise(c, getUserRole(userId))
  const { email, name } = await runApproverIdentityLookup(requireDomainContext(c), userId)
  return { id: userId, name, email, role }
}

const applyDecision = async (
  c: Readonly<Context>,
  record: ApprovalRecord,
  decision: Decision,
  approver: Approver
): Promise<Response> => {
  const nextStatus: ApprovalStatus = decision === 'approve' ? 'approved' : 'rejected'
  // Approved actions execute under the AGENT's identity, never the approver's.
  const next =
    updateApproval(record.id, {
      status: nextStatus,
      approvedByEmail: approver.email,
      ...(decision === 'approve' && { actionExecuted: true, executedAs: record.agentName }),
    }) ?? record

  await runApprovalMirror(requireDomainContext(c), MirrorApprovalUpdate(toMirrorRecord(next)))

  appendActivityEntry({
    id: crypto.randomUUID(),
    action: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
    approvalId: next.id,
    agentName: next.agentName,
    actor: { id: approver.id, name: approver.name, email: approver.email },
    createdAt: new Date().toISOString(),
    runStartedById: next.requestedById,
  })

  return c.json(serializeApproval(next), 200)
}
