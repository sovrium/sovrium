/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The chat routes' side of a turn: the steps only a route can take, handed to
 * the turn's program (`application/use-cases/agents/chat-turn/run-chat-turn.ts`),
 * and that program composed into the handler's own, buffered or streamed.
 *
 * Every step is an Effect run inside the turn, on the request's services. A
 * step that fails fails the turn with a `ChatTurnStepError`, which the route
 * answers through the sanitized error envelope.
 */

import { Effect } from 'effect'
import {
  runChatTurn,
  type ChatTurnError,
  type ChatTurnSteps,
  type TurnOutcome,
} from '@/application/use-cases/agents/chat-turn/run-chat-turn'
import {
  answerFailures,
  toErrorResponse,
  type HandlerAnswer,
} from '@/presentation/api/runtime/run-effect'
import { chatProviderFailure, chatTurnSpec } from './chat-agent-turn'
import { appendConversationTurn, getConversationHistory } from './chat-conversation-store'
import { keepReadableHits } from './chat-knowledge-citations'
import { keepListedExchanges } from './chat-replay-scope'
import { respondWithTurnStream } from './chat-stream'
import { respondWithActions, toolTurnActions } from './chat-tool-reply'
import { finishChatTurn, type ChatTurnInput } from './chat-turn-completion'
import { questionContent, readCarriedFiles, readStoredHistory } from './chat-turn-parts'
import type { AdmittedTurnParts } from './chat-turn-parts'
import type { AgentTurnSpec } from '@/application/use-cases/agents/agent-runtime'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type { App } from '@/domain/models/app'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/** The steps of a turn the chat routes run, for the caller its input names. */
const chatTurnSteps = (c: Context): ChatTurnSteps<ChatTurnInput, DomainServices> => ({
  sessionHistory: (turn) => Effect.sync(() => getConversationHistory(c, turn.sessionId)),
  keepListedExchanges: (turn, exchanges) =>
    keepListedExchanges({ app: turn.app, reader: turn.reader }, exchanges),
  replayExchanges: (turn, exchanges) => readStoredHistory(turn.actorName, exchanges),
  carriedFiles: (turn) => readCarriedFiles(turn.actorName, turn.sessionId),
  // The caller's read gate, exactly as the search route runs it.
  keepReadable: (turn, app, hits) => keepReadableHits(app, turn.reader, hits),
  buildSpec: (turn, options) => chatTurnSpec(turn, options),
})

/** A stream bound to no agent: the caller's question alone, no tools, no history. */
export interface GenericStreamTurn {
  readonly message: string
  readonly sessionId: string
  readonly actorName: string
  readonly systemPrompt: string
  readonly app?: App | undefined
  readonly parts?: AdmittedTurnParts | undefined
}

/** The model's answer to the question alone, with the files sent earlier in its conversation. */
const genericStreamSpec = (
  turn: GenericStreamTurn,
  carried: Parameters<typeof questionContent>[2]
): AgentTurnSpec<StepRequirements> => ({
  surface: 'chat',
  app: turn.app,
  chatActor: turn.actorName,
  tools: { runAction: () => Effect.succeed({ ok: false, error: 'no actions' }) },
  messages: [{ role: 'user', content: questionContent(turn.message, turn.parts, carried) }],
  toolDefinitions: [],
  maxSteps: 1,
  stream: true,
})

/**
 * The steps of a generic stream: it replays no history and is bound to no
 * agent, so it reads no knowledge — only the files its conversation was sent.
 */
const genericStreamSteps: ChatTurnSteps<GenericStreamTurn, DomainServices> = {
  sessionHistory: () => Effect.succeed([]),
  keepListedExchanges: () => Effect.succeed([]),
  replayExchanges: () => Effect.succeed([]),
  carriedFiles: (turn) => readCarriedFiles(turn.actorName, turn.sessionId),
  keepReadable: () => Effect.succeed([]),
  buildSpec: (turn, options) => Effect.succeed(genericStreamSpec(turn, options.carried)),
}

/** Answer a turn that failed: a provider's failure with its status, a step's as a fault. */
const answerTurnFailure = (c: Context, failure: ChatTurnError, actorName: string) =>
  failure._tag === 'ChatTurnStepError'
    ? Effect.succeed(toErrorResponse(c, failure.cause))
    : chatProviderFailure(c, failure, actorName)

/** Answer a buffered turn's outcome with the `{ reply, actions, sessionId }` envelope. */
const respondToOutcome = (
  c: Context,
  asked: ChatTurnInput,
  outcome: TurnOutcome<ChatTurnInput>
): Effect.Effect<Response, never, DomainServices> => {
  if (outcome.kind === 'prose')
    return answerFailures(c, finishChatTurn(c, outcome.turn, outcome.reply))
  if (outcome.kind === 'streamed')
    return Effect.die(new Error('A buffered chat turn cannot stream.'))
  appendConversationTurn(c, asked, asked.message, outcome.reply)
  return Effect.succeed(
    respondWithActions(c, {
      reply: outcome.reply,
      actions: toolTurnActions(outcome.toolResults),
      sessionId: asked.sessionId,
      rateLimitRemaining: asked.rateLimitRemaining,
      citations: outcome.citations,
    })
  )
}

/**
 * One buffered chat turn, answered.
 *
 * A turn that called tools answers with the model's final reply and one action
 * per tool call. A turn that called none completes as it always has: an
 * agent's prose is its answer, and a generic turn's prose goes through the
 * record-query / mutation / automation-trigger completion — never an agent's,
 * whose own phrasing must not be replaced by a table dump.
 */
export const answerChatTurn = (
  c: Context,
  asked: ChatTurnInput
): Effect.Effect<Response, never, DomainServices> =>
  runChatTurn(asked, chatTurnSteps(c), { kind: 'buffered' }).pipe(
    Effect.matchEffect({
      onFailure: (failure) => answerTurnFailure(c, failure, asked.actorName),
      onSuccess: (outcome) => respondToOutcome(c, asked, outcome),
    })
  )

/** One streamed turn of the program, forwarded until the stream ends. */
const streamTurn = <I extends ChatTurnInput | GenericStreamTurn>(
  c: Context,
  handle: HandlerAnswer,
  turn: I,
  run: {
    readonly steps: ChatTurnSteps<I, DomainServices>
    readonly parentId: string | undefined
  }
): Effect.Effect<Response, never, DomainServices> =>
  respondWithTurnStream(c, handle, { userId: turn.actorName, sessionId: turn.sessionId }, (wire) =>
    runChatTurn(turn, run.steps, { kind: 'stream', wire, parentId: run.parentId })
  )

/** Stream an agent-bound turn: its prompt, its tools, its gates and its knowledge. */
export const streamAgentChatTurn = (
  c: Context,
  handle: HandlerAnswer,
  turn: ChatTurnInput,
  parentId: string | undefined
): Effect.Effect<Response, never, DomainServices> =>
  streamTurn(c, handle, turn, { steps: chatTurnSteps(c), parentId })

/** Stream a generic turn: the model's answer to the question alone. */
export const streamGenericChatTurn = (
  c: Context,
  handle: HandlerAnswer,
  turn: GenericStreamTurn,
  parentId: string | undefined
): Effect.Effect<Response, never, DomainServices> =>
  streamTurn(c, handle, turn, { steps: genericStreamSteps, parentId })
