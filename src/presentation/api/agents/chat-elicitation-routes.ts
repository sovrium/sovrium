/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Answering, from the chat window, a question the agent asked (`ask_user`) —
 * `POST /api/ai/chat/elicitations/:elicitationId` with `{ action, content? }`.
 *
 * A streamed chat turn whose agent asks the person a question emits `elicit`
 * and ends as `done { stopReason: 'awaiting_input' }`. The person answers here,
 * and the answer IS the rest of the turn, as a new stream of the same events:
 * the model reads her answer as the question's result and goes on.
 *
 * - `accept` carries the form's values, checked against the question before
 *   the model sees them: a missing required field, a value outside the
 *   choices or of the wrong type answers 400, names the field, and the
 *   question stays open.
 * - `decline` skips the question: the model is told so, with no content, and
 *   goes on without the answer.
 * - `cancel` dismisses it — the person sent a new message instead. The
 *   question closes WITHOUT resuming the turn: no model call, no tool runs.
 *   The paused turn is saved to the conversation, its question marked
 *   cancelled, and the answer is `{ status: 'cancelled' }`, not a stream.
 *
 * A question an external MCP server asked during a tool call (`server` on the
 * `elicit` event) is answered the same way: the answer goes to the server as
 * its elicitation result, the tool call finishes, and — unless she cancelled —
 * the model reads the server's result and goes on.
 *
 * Only she answers. For anyone else the question does not exist: 404, as for
 * an unknown id (S1). A question already answered, or open too long, answers
 * 409 and resumes nothing.
 */

import { Effect } from 'effect'
import { resumeAnsweredTurn } from '@/application/use-cases/agents/agent-elicitation-resume'
import { rememberChatTurn } from '@/application/use-cases/agents/chat-turn/durable-memory'
import { forwardChatTurnStream } from '@/application/use-cases/agents/chat-turn/stream-chat-turn'
import {
  chatElicitationCancelledResponseSchema,
  elicitationAnswerSchema,
} from '@/domain/models/api/ai/chat'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  checkElicitationContent,
  elicitationResultText,
  type ElicitationAnswer,
} from '@/domain/models/app/agents/ask-user-service'
import {
  closeChatElicitation,
  findChatElicitation,
  type HeldChatElicitation,
} from '@/presentation/api/agents/chat-elicitations'
import { withChatTurnReads } from '@/presentation/api/agents/chat-reader-rows'
import { respondWithTurnStream } from '@/presentation/api/agents/chat-stream'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  respondWith,
  runHandlerEffect,
  runHandlerStream,
  type HandlerAnswer,
} from '@/presentation/api/runtime/run-effect'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import type { Context, Hono, TypedResponse } from 'hono'

const NOT_FOUND = 'Question not found.'

/** The 409 a question answers once it is closed. */
const closed = (c: Context, reason: 'answered' | 'expired'): Response => {
  const why = reason === 'answered' ? 'was already answered' : 'waited too long for an answer'
  const error = `This question ${why} and can no longer be answered.`
  return c.json(errorBody({ error, code: ApiErrorCode.CONFLICT }), 409)
}

/** The answer the model reads, or the 400 saying which field does not fit. */
const readAnswer = (
  c: Context,
  held: HeldChatElicitation,
  body: typeof elicitationAnswerSchema.Type
): { readonly answer: ElicitationAnswer } | { readonly refusal: Response } => {
  if (body.action !== 'accept') return { answer: { action: body.action } }
  const check = checkElicitationContent(held.elicitation.requestedSchema, body.content ?? {})
  if (check.ok) return { answer: { action: 'accept', content: check.content } }
  const envelope = errorBody({ error: check.message, code: ApiErrorCode.VALIDATION_ERROR })
  return { refusal: c.json({ ...envelope, field: check.field }, 400) }
}

/**
 * What the model reads as the question's result: the answer itself for the
 * agent's own question; for a server's, the server's result for the tool call,
 * once the answer was relayed to it and the call finished.
 */
const questionResult = (held: HeldChatElicitation, answer: ElicitationAnswer) => {
  const { relay } = held.elicitation
  return relay === undefined ? Effect.succeed(elicitationResultText(answer)) : relay(answer)
}

/** Stream the rest of the paused turn, the answer as its question's result. */
const streamAnsweredTurn = (
  c: Context,
  handle: HandlerAnswer,
  input: { readonly held: HeldChatElicitation; readonly answer: ElicitationAnswer }
) =>
  Effect.gen(function* () {
    const { held } = input
    const { continuation } = held.elicitation
    if (continuation === undefined) return notFound(c, NOT_FOUND)
    const result = yield* questionResult(held, input.answer)
    return yield* respondWithTurnStream(c, handle, held, (wire) =>
      forwardChatTurnStream(
        {
          ...held,
          // The answered turn is saved as it always was: without the question's parts.
          userParts: undefined,
          resumed: resumeAnsweredTurn({ continuation, answer: result, spec: held.spec }),
        },
        wire
      )
    )
  })

/**
 * A dismissed question: the turn does NOT resume — no model call — and is
 * saved as it stood, the person's message and the agent's question, marked
 * cancelled. A server's question is answered `cancel` first, so its tool call
 * completes; its result is not handed to anyone. The person's next message
 * carries the conversation on. The save is best-effort, like every chat save:
 * the question is closed either way.
 */
const cancelledTurn = (c: Context, held: HeldChatElicitation) =>
  Effect.gen(function* () {
    yield* questionResult(held, { action: 'cancel' })
    yield* rememberChatTurn({
      userId: held.userId,
      sessionId: held.sessionId,
      userMessage: held.message,
      assistantReply: '',
      ...(held.agentName !== undefined && { agentName: held.agentName }),
      parentId: held.parentId,
      assistantElicitation: {
        message: held.elicitation.message,
        state: 'cancelled',
        ...(held.elicitation.server !== undefined && { server: held.elicitation.server }),
      },
    })
    return yield* respondWith(
      c,
      Effect.succeed({ status: 'cancelled', elicitationId: held.elicitation.id }),
      chatElicitationCancelledResponseSchema
    )
  })

/** A cancel closes the paused turn where it stood; any other answer resumes it. */
const respond = (c: Context, held: HeldChatElicitation, answer: ElicitationAnswer) =>
  answer.action === 'cancel'
    ? runHandlerEffect(c, cancelledTurn(c, held))
    : runHandlerStream(c, (handle) =>
        withChatTurnReads(streamAnsweredTurn(c, handle, { held, answer }))
      )

const handleChatElicitation = async (c: Context): Promise<Response | TypedResponse<unknown>> => {
  const userId = getSessionContext(c)?.userId
  if (process.env.AI_PROVIDER === undefined || userId === undefined) return notFound(c, NOT_FOUND)
  const lookup = findChatElicitation(c.req.param('elicitationId') ?? '', userId)
  if (lookup.kind === 'none') return notFound(c, NOT_FOUND)
  const body = await validateRequest(c, elicitationAnswerSchema)
  if (!body.success) return body.response
  if (lookup.kind === 'closed') return closed(c, lookup.reason)
  const read = readAnswer(c, lookup.held, body.data)
  if ('refusal' in read) return read.refusal
  // One answer only ever resumes the turn: a second one, sent meanwhile, is too late.
  if (!closeChatElicitation(lookup.held.elicitation.id)) return closed(c, 'answered')
  return respond(c, lookup.held, read.answer)
}

/** Chain `POST /api/ai/chat/elicitations/:elicitationId` onto the chat routes. */
export const chainAiChatElicitationRoutes = (honoApp: Hono): Hono =>
  honoApp.post('/api/ai/chat/elicitations/:elicitationId', (c) => handleChatElicitation(c))
