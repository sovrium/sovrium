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
 * Only she decides, and an email, a web request or a file change she asked
 * for she may only reject: someone else approves it (`refusesOwnApproval`),
 * unless she is admin-equivalent. For anyone else — another member, an admin, a visitor —
 * the approval does not exist: 404, as for an unknown id (S1). An approval
 * decided elsewhere (the agent approvals API), or past its timeout, answers
 * 409 and runs nothing. The paused turn lives in this process: a decision
 * takes it, so a second decision finds nothing (404), and so does one made
 * after the server restarted.
 *
 * The decision lands where every approval decision does: on the approval
 * itself, its database mirror and the activity feed.
 */

import { Effect, Schema } from 'effect'
import {
  resumeDecidedTurn,
  type HeldCallDecision,
} from '@/application/use-cases/agents/agent-approval-decision-stream'
import { forwardChatTurnStream } from '@/application/use-cases/agents/chat-turn/stream-chat-turn'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  ownApprovalRefused,
  recordApprovalOutcome,
  refusesOwnApproval,
} from '@/presentation/api/agents/approval-decision'
import { approverIdentityOrBlank } from '@/presentation/api/agents/approval-mirror'
import { readApproval } from '@/presentation/api/agents/approval-store-access'
import { withChatTurnReads } from '@/presentation/api/agents/chat-reader-rows'
import { respondWithTurnStream } from '@/presentation/api/agents/chat-stream'
import {
  holdsChatTurn,
  takeHeldChatTurn,
  type HeldChatTurn,
} from '@/presentation/api/agents/chat-stream-events'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  runHandlerStream,
  type HandlerAnswer,
} from '@/presentation/api/runtime/run-effect'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { App } from '@/domain/models/app'
import type { ApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import type { Context, Hono, TypedResponse } from 'hono'

const decisionBodySchema = Schema.Struct({
  decision: Schema.Literals(['approve', 'reject']),
})

const NOT_FOUND = 'Approval not found.'

/** Record the person's decision on the approval, its mirror and the activity feed. */
const recordDecision = (input: {
  readonly record: ApprovalRecord
  readonly decision: HeldCallDecision
  readonly userId: string
}) =>
  Effect.gen(function* () {
    const { record, decision, userId } = input
    const { name, email } = yield* approverIdentityOrBlank(userId)
    yield* recordApprovalOutcome({ record, decision, approver: { id: userId, name, email } })
  })

/** Stream the rest of the held turn, after its decision. */
const streamDecidedTurn = (
  c: Context,
  handle: HandlerAnswer,
  input: {
    readonly approvalId: string
    readonly decision: HeldCallDecision
    readonly held: HeldChatTurn
  }
) => {
  const { held } = input
  return respondWithTurnStream(c, handle, held, (wire) =>
    forwardChatTurnStream(
      {
        ...held,
        resumed: resumeDecidedTurn({
          approvalId: input.approvalId,
          decision: input.decision,
          spec: held.spec,
        }),
      },
      wire
    )
  )
}

/**
 * Decide on the held call. Her own approval of a held side effect is refused
 * (403) before the turn is taken, so the turn stays held for whoever may
 * approve it, or for her to reject.
 */
const handleChatApproval = async (
  c: Context,
  app: App | undefined
): Promise<Response | TypedResponse<unknown>> => {
  const userId = getSessionContext(c)?.userId
  if (process.env.AI_PROVIDER === undefined || userId === undefined) return notFound(c, NOT_FOUND)
  const body = await validateRequest(c, decisionBodySchema)
  if (!body.success) return body.response
  const approvalId = c.req.param('approvalId') ?? ''
  if (!holdsChatTurn(approvalId, userId)) return notFound(c, NOT_FOUND)
  const decided = { approvalId, userId, decision: body.data.decision }
  return runHandlerStream(c, (handle) =>
    answerFailures(c, withChatTurnReads(decideHeldCall(c, handle, { app, ...decided })))
  )
}

/** The decision on a call held for this person, once her turn is known to be held. */
const decideHeldCall = (
  c: Context,
  handle: HandlerAnswer,
  input: {
    readonly app: App | undefined
    readonly approvalId: string
    readonly userId: string
    readonly decision: HeldCallDecision
  }
) =>
  Effect.gen(function* () {
    const { app, approvalId, userId, decision } = input
    const record = yield* readApproval(approvalId)
    if (record === undefined) return notFound(c, NOT_FOUND)
    if (record.status !== 'pending') {
      const error = `This approval is ${record.status} and can no longer be decided.`
      return c.json(errorBody({ error, code: ApiErrorCode.CONFLICT }), 409)
    }
    const role = yield* getUserRole(userId)
    if (refusesOwnApproval({ app, record, decision, approver: { id: userId, role } })) {
      return ownApprovalRefused(c)
    }
    const held = takeHeldChatTurn(approvalId, userId)
    if (held === undefined) return notFound(c, NOT_FOUND)
    yield* recordDecision({ record, decision, userId })
    return yield* streamDecidedTurn(c, handle, { approvalId, decision, held })
  })

/** Chain `POST /api/ai/chat/approvals/:approvalId` onto the chat routes. */
export const chainAiChatApprovalRoutes = (honoApp: Hono, app?: App): Hono =>
  honoApp.post('/api/ai/chat/approvals/:approvalId', (c) => handleChatApproval(c, app))
