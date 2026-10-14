/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Deciding, from the chat window, on a call the agent held for approval —
 * `POST /api/ai/chat/approvals/:approvalId` with `{ decision }`.
 *
 * A streamed chat turn whose agent calls an action its approval rule covers
 * ends as `done { stopReason: 'awaiting_input' }`, the held call reported as
 * `tool_result { outcome: 'pending-approval', approvalId }`. The person the
 * turn answered decides it here, and the answer IS the rest of the turn, as a
 * new stream of the same events: approved, the call runs (as her, under the
 * agent's gates) and the agent goes on; rejected, nothing runs, the model is
 * told so, and it answers.
 *
 * Only she decides. For anyone else — another member, an admin, a visitor —
 * the approval does not exist: 404, as for an unknown id (S1). An approval
 * decided elsewhere (the agent approvals API), or past its timeout, answers
 * 409 and runs nothing. The paused turn lives in this process: a decision
 * takes it, so a second decision finds nothing (404), and so does one made
 * after the server restarted.
 *
 * The decision lands where every approval decision does: on the approval
 * itself, its database mirror and the activity feed.
 */

import { Schema } from 'effect'
import {
  resumeDecidedTurn,
  type HeldCallDecision,
} from '@/application/use-cases/agents/agent-approval-decision-stream'
import { MirrorApprovalUpdate } from '@/application/use-cases/agents/approval'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { requireDomainContext, type DomainContext } from '@/infrastructure/logging/request-effect'
import {
  runApprovalMirror,
  runApproverIdentityLookup,
  toMirrorRecord,
} from '@/presentation/api/agents/approval-mirror'
import {
  decideApproval,
  readApproval,
  recordApprovalDecision,
} from '@/presentation/api/agents/approval-store-access'
import { buildStreamResponse } from '@/presentation/api/agents/chat-stream'
import { takeHeldChatTurn, type HeldChatTurn } from '@/presentation/api/agents/chat-stream-events'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import type { Context, Hono, TypedResponse } from 'hono'

const decisionBodySchema = Schema.Struct({
  decision: Schema.Literals(['approve', 'reject']),
})

const NOT_FOUND = 'Approval not found.'

/** Record the person's decision on the approval, its mirror and the activity feed. */
const recordDecision = async (
  services: DomainContext,
  input: {
    readonly record: ApprovalRecord
    readonly decision: HeldCallDecision
    readonly userId: string
  }
): Promise<void> => {
  const { record, decision, userId } = input
  const approver = await runApproverIdentityLookup(services, userId)
  const next =
    (await decideApproval(services, record.id, {
      status: decision === 'approve' ? 'approved' : 'rejected',
      approvedByEmail: approver.email,
      ...(decision === 'approve' && { actionExecuted: true, executedAs: record.agentName }),
    })) ?? record
  await runApprovalMirror(services, MirrorApprovalUpdate(toMirrorRecord(next)))
  await recordApprovalDecision(services, {
    action: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
    approvalId: next.id,
    agentName: next.agentName,
    actor: { id: userId, name: approver.name, email: approver.email },
    runStartedById: next.requestedById,
  })
}

/** Stream the rest of the held turn, after its decision. */
const streamDecidedTurn = (
  c: Context,
  input: {
    readonly approvalId: string
    readonly decision: HeldCallDecision
    readonly held: HeldChatTurn
  }
): Promise<Response> => {
  const { held } = input
  return buildStreamResponse(c, {
    services: requireDomainContext(c),
    message: held.message,
    sessionId: held.sessionId,
    userId: held.userId,
    spec: held.spec,
    agentName: held.agentName,
    passages: held.passages,
    parentId: held.parentId,
    userParts: held.userParts,
    events: resumeDecidedTurn({
      approvalId: input.approvalId,
      decision: input.decision,
      spec: held.spec,
    }),
  })
}

const handleChatApproval = async (c: Context): Promise<Response | TypedResponse<unknown>> => {
  const userId = getSessionContext(c)?.userId
  if (process.env.AI_PROVIDER === undefined || userId === undefined) return notFound(c, NOT_FOUND)
  const body = await validateRequest(c, decisionBodySchema)
  if (!body.success) return body.response
  const approvalId = c.req.param('approvalId') ?? ''
  const held = takeHeldChatTurn(approvalId, userId)
  if (held === undefined) return notFound(c, NOT_FOUND)
  const services = requireDomainContext(c)
  const record = await readApproval(services, approvalId)
  if (record === undefined) return notFound(c, NOT_FOUND)
  if (record.status !== 'pending') {
    const error = `This approval is ${record.status} and can no longer be decided.`
    return c.json(errorBody({ error, code: ApiErrorCode.CONFLICT }), 409)
  }
  const { decision } = body.data
  await recordDecision(services, { record, decision, userId })
  return streamDecidedTurn(c, { approvalId, decision, held })
}

/** Chain `POST /api/ai/chat/approvals/:approvalId` onto the chat routes. */
export const chainAiChatApprovalRoutes = (honoApp: Hono): Hono =>
  honoApp.post('/api/ai/chat/approvals/:approvalId', (c) => handleChatApproval(c))
