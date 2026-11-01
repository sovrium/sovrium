/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One chat turn, buffered or streamed, as one program: the retention sweep,
 * the history it replays, the files it carries, the agent's knowledge, the
 * model's turn on the agent runtime, and what is remembered of it. Each step
 * opens its own span under the turn's, so the turn is one trace and one
 * interruption domain.
 *
 * What a route alone can do — read the caller's browser-held history, judge a
 * replayed exchange or a knowledge chunk against her read gates, build the
 * tools her role reaches — is handed in as {@link ChatTurnSteps}, each an
 * Effect run inside this program. A route's own turn input travels through
 * unchanged and is handed back to those steps.
 */

import { Data, Effect } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { recordAiActivity } from '@/application/use-cases/ai/record-ai-activity'
import {
  citationsOf,
  knowledgePromptSection,
  type KnowledgePassage,
} from '@/domain/models/app/agents/knowledge-citation-service'
import { storedToolCalls } from '@/domain/models/app/agents/stored-tool-call-service'
import { toolTurnReply } from '@/domain/models/app/agents/tool-turn-reply-service'
import {
  resolveChatMemoryContextMessages,
  resolveChatMemoryMaxAgeDays,
} from '@/domain/models/process-env/ai/ai-chat-turn'
import { logError } from '@/infrastructure/logging/logger'
import { runAgentTurnToEnd, type AgentTurnSpec } from '../agent-runtime'
import { recallDurableHistory, rememberChatTurn, sweepExpiredConversations } from './durable-memory'
import {
  forwardChatTurnStream,
  type ChatStreamOpenError,
  type ChatTurnWire,
  type StreamedTurnRequirements,
} from './stream-chat-turn'
import { gatherTurnKnowledge, type TurnAgentRef } from './turn-knowledge'
import type { AiActivityLogRepository } from '@/application/ports/repositories/ai/ai-activity-log-repository'
import type {
  AiEmbeddingRepository,
  EmbeddingSearchResult,
} from '@/application/ports/repositories/ai/ai-embedding-repository'
import type {
  AiMemoryMessage,
  AiMemoryRepository,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import type { ChatAttachmentRepository } from '@/application/ports/repositories/ai/chat-attachment-repository'
import type {
  AiError,
  AiService,
  ChatMessage,
  MessagePart,
} from '@/application/ports/services/ai-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { AgentToolResult } from '@/application/use-cases/agents/agent-tool-call'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type { ChatCitation } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'

/** The signed-out caller with no session, whose conversation lives in her browser's store. */
const ANONYMOUS = 'anonymous'

/** What the program reads of a turn. A route's input carries more, handed back to its steps. */
export interface ChatTurnSubject {
  readonly message: string
  readonly sessionId: string
  /** The acting user's id, or `anonymous`. */
  readonly actorName: string
  readonly systemPrompt: string
  readonly app?: App | undefined
  /** The agent the turn is bound to; none for a generic turn. */
  readonly agent?: TurnAgentRef | undefined
  /** The question's parts, when it was sent as parts: what is saved with it. */
  readonly parts?: { readonly stored: ReadonlyArray<AiMessagePart> } | undefined
}

/** A replayed message, before its files are read anew. */
export interface ReplayedExchange {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly parts?: ReadonlyArray<AiMessagePart> | undefined
}

/** How a turn's spec is built: what it replays, the files it carries, whether it streams. */
export interface TurnSpecOptions {
  readonly history: ReadonlyArray<ChatMessage>
  readonly carried: ReadonlyArray<MessagePart>
  readonly stream: boolean
}

/** A step a route hands the turn, which failed: the turn fails with its cause. */
export class ChatTurnStepError extends Data.TaggedError('ChatTurnStepError')<{
  readonly step: string
  readonly cause: unknown
}> {}

/** The steps only a route can take, run inside the turn. */
export interface ChatTurnSteps<I extends ChatTurnSubject, R> {
  /** A signed-out caller's earlier messages: her browser's own conversation. */
  readonly sessionHistory: (turn: I) => Effect.Effect<ReadonlyArray<ChatMessage>, never, R>
  /** The stored exchanges whose answers read only tables the caller still lists. */
  readonly keepListedExchanges: (
    turn: I,
    exchanges: ReadonlyArray<AiMemoryMessage>
  ) => Effect.Effect<ReadonlyArray<AiMemoryMessage>, ChatTurnStepError, R>
  /** Replayed messages as the model reads them, each file read anew. */
  readonly replayExchanges: (
    turn: I,
    exchanges: ReadonlyArray<ReplayedExchange>
  ) => Effect.Effect<ReadonlyArray<ChatMessage>, never, R>
  /** The files sent earlier in the conversation. */
  readonly carriedFiles: (turn: I) => Effect.Effect<ReadonlyArray<MessagePart>, never, R>
  /** The knowledge chunks the caller may read, through her read gate. */
  readonly keepReadable: (
    turn: I,
    app: App,
    hits: ReadonlyArray<EmbeddingSearchResult>
  ) => Effect.Effect<ReadonlyArray<EmbeddingSearchResult>, ChatTurnStepError, R>
  /** The turn the agent runtime runs: its messages, its tools, its model settings. */
  readonly buildSpec: (
    turn: I,
    options: TurnSpecOptions
  ) => Effect.Effect<AgentTurnSpec<StepRequirements>, ChatTurnStepError, R>
}

/** How the turn answers: whole, or streamed through a wire. */
export type ChatTurnTransport =
  | { readonly kind: 'buffered' }
  | {
      readonly kind: 'stream'
      readonly wire: ChatTurnWire
      /** The message the turn follows, which its exchange is saved below. */
      readonly parentId?: string | undefined
    }

/** What a turn came to. */
export type TurnOutcome<I> =
  /** Answered and remembered: an agent's answer, or a turn that called tools. */
  | {
      readonly kind: 'replied'
      readonly reply: string
      readonly toolResults: ReadonlyArray<AgentToolResult>
      readonly citations: ReadonlyArray<ChatCitation> | undefined
    }
  /** A generic turn's prose, which the route completes as a query, a trigger or a write. */
  | { readonly kind: 'prose'; readonly turn: I; readonly reply: string }
  /** Streamed through the wire, and remembered when its stream completed. */
  | { readonly kind: 'streamed' }

export type ChatTurnError = AiError | ChatStreamOpenError | ChatTurnStepError

/** What a chat turn needs from the server, besides its route's steps. */
export type ChatTurnRequirements =
  | StreamedTurnRequirements
  | AiService
  | AiEmbeddingRepository
  | AiMemoryRepository
  | AiActivityLogRepository
  | ChatAttachmentRepository
  | StorageService

/**
 * Whether a turn replays its conversation's earlier messages. An agent-bound
 * turn does not: fact extraction re-derives a fact per turn, so a replayed
 * history would make an agent re-learn its first fact every turn. The System
 * Agent, which keeps no facts, replays like a generic turn.
 */
const replaysHistory = (agent: TurnAgentRef | undefined): boolean =>
  agent === undefined || agent.builtIn === true

/** The agent an exchange is attributed to: a declared one, never the System Agent. */
const attributionOf = (agent: TurnAgentRef | undefined): string | undefined =>
  agent === undefined || agent.builtIn === true ? undefined : agent.name

/** Delete the caller's conversations past `AI_MEMORY_MAX_AGE_DAYS`, before the new turn lands. */
const sweepCallerConversations = Effect.fn('agents.chat.sweep-caller-conversations')(function* (
  userId: string
): Effect.fn.Return<void, never, AiMemoryRepository | ChatAttachmentRepository | StorageService> {
  const maxAgeDays = resolveChatMemoryMaxAgeDays(yield* ProcessEnv)
  yield* sweepExpiredConversations({ userId, maxAgeDays })
})

/**
 * The earlier messages a turn replays: none for an agent-bound turn; a
 * signed-out caller's from her browser; anyone else's from durable memory,
 * without the exchanges whose answers read a table she no longer lists, the
 * most recent `AI_MEMORY_CONTEXT_MESSAGES` of them.
 */
const replayTurnHistory = Effect.fn('agents.chat.replay-turn-history')(function* <
  I extends ChatTurnSubject,
  R,
>(
  turn: I,
  steps: ChatTurnSteps<I, R>
): Effect.fn.Return<ReadonlyArray<ChatMessage>, ChatTurnStepError, R | AiMemoryRepository> {
  if (!replaysHistory(turn.agent)) return []
  if (turn.actorName === ANONYMOUS) return yield* steps.sessionHistory(turn)
  const recalled = yield* recallDurableHistory({
    userId: turn.actorName,
    sessionId: turn.sessionId,
  })
  const listed = yield* steps.keepListedExchanges(turn, recalled)
  const exchanges = listed.map((message): ReplayedExchange => ({
    role: message.role === 'user' ? 'user' : 'assistant',
    content: message.content,
    parts: message.parts,
  }))
  const limit = resolveChatMemoryContextMessages(yield* ProcessEnv)
  const kept =
    limit !== undefined && exchanges.length > limit
      ? exchanges.slice(exchanges.length - limit)
      : exchanges
  return yield* steps.replayExchanges(turn, kept)
})

/**
 * The agent's knowledge for the question, through the caller's read gate,
 * numbered into the turn's system prompt. A turn handed no passage is
 * unchanged.
 */
const foldTurnKnowledge = Effect.fn('agents.chat.fold-turn-knowledge')(function* <
  I extends ChatTurnSubject,
  R,
>(
  turn: I,
  steps: ChatTurnSteps<I, R>
): Effect.fn.Return<
  { readonly turn: I; readonly passages: ReadonlyArray<KnowledgePassage> },
  ChatTurnStepError,
  R | AiService | AiEmbeddingRepository
> {
  const passages = yield* gatherTurnKnowledge({
    app: turn.app,
    agent: turn.agent,
    question: turn.message,
    keepReadable: (app, hits) => steps.keepReadable(turn, app, hits),
  })
  if (passages.length === 0) return { turn, passages }
  const systemPrompt = `${turn.systemPrompt}\n\n${knowledgePromptSection(passages)}`
  return { turn: { ...turn, systemPrompt }, passages }
})

/** Record a chat interaction in the activity log; a failed write never fails the turn. */
const noteChatActivity = (
  action: string,
  actorName: string
): Effect.Effect<void, never, AiActivityLogRepository> =>
  recordAiActivity({ actorType: 'user', actorName, action }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[ai-chat] recording the chat activity failed', cause))
    ),
    // effect-swallow: the answer is already given; a missing activity row is logged above and never fails the turn.
    Effect.result,
    Effect.asVoid
  )

/**
 * Settle a buffered turn the model answered. A generic turn that called no
 * tool hands its prose back to the route; any other is remembered — the
 * model's answer, or for a turn that called tools its reply about them, with
 * one line per call — and recorded.
 */
const settleAnsweredTurn = Effect.fn('agents.chat.settle-answered-turn')(function* <
  I extends ChatTurnSubject,
>(
  turn: I,
  known: { readonly turn: I; readonly passages: ReadonlyArray<KnowledgePassage> },
  answered: { readonly reply: string; readonly toolResults: ReadonlyArray<AgentToolResult> }
): Effect.fn.Return<TurnOutcome<I>, never, AiMemoryRepository | AiActivityLogRepository> {
  const { reply, toolResults } = answered
  const calledTools = toolResults.length > 0
  if (!calledTools && turn.agent === undefined) return { kind: 'prose', turn: known.turn, reply }
  const answer = calledTools ? toolTurnReply(reply, toolResults) : reply
  const agentName = attributionOf(turn.agent)
  yield* rememberChatTurn({
    userId: turn.actorName,
    sessionId: turn.sessionId,
    userMessage: turn.message,
    assistantReply: answer,
    userParts: turn.parts?.stored,
    ...(calledTools && { assistantToolCalls: storedToolCalls(toolResults) }),
    ...(agentName !== undefined && { agentName }),
  })
  yield* noteChatActivity('ai.chat.message', turn.actorName)
  const cited = citationsOf(answer, known.passages)
  return {
    kind: 'replied',
    reply: answer,
    toolResults,
    citations: cited.length === 0 ? undefined : cited,
  }
})

/** A buffered turn: swept, replayed, informed, run to its end, settled. */
const answerChatTurn = Effect.fn('agents.chat.answer-turn')(function* <
  I extends ChatTurnSubject,
  R,
>(
  turn: I,
  steps: ChatTurnSteps<I, R>
): Effect.fn.Return<TurnOutcome<I>, AiError | ChatTurnStepError, ChatTurnRequirements | R> {
  yield* sweepCallerConversations(turn.actorName)
  const history = yield* replayTurnHistory(turn, steps)
  // A turn replaying no message still carries the files sent earlier in its conversation.
  const carried = replaysHistory(turn.agent) ? [] : yield* steps.carriedFiles(turn)
  const known = yield* foldTurnKnowledge(turn, steps)
  const spec = yield* steps.buildSpec(known.turn, { history, carried, stream: false })
  const result = yield* runAgentTurnToEnd(spec)
  return yield* settleAnsweredTurn(turn, known, result)
})

/**
 * A streamed turn: it replays no history, so it carries the conversation's
 * files — save for the System Agent, which carries none. Swept once its turn
 * is built, then forwarded through the wire.
 */
const streamChatTurn = Effect.fn('agents.chat.stream-turn')(function* <
  I extends ChatTurnSubject,
  R,
>(
  turn: I,
  steps: ChatTurnSteps<I, R>,
  transport: Extract<ChatTurnTransport, { readonly kind: 'stream' }>
): Effect.fn.Return<void, ChatStreamOpenError | ChatTurnStepError, ChatTurnRequirements | R> {
  const known = yield* foldTurnKnowledge(turn, steps)
  const carriesFiles = turn.agent === undefined || !replaysHistory(turn.agent)
  const carried = carriesFiles ? yield* steps.carriedFiles(turn) : []
  const spec = yield* steps.buildSpec(known.turn, { history: [], carried, stream: true })
  yield* sweepCallerConversations(turn.actorName)
  yield* forwardChatTurnStream(
    {
      userId: turn.actorName,
      sessionId: turn.sessionId,
      message: turn.message,
      spec,
      agentName: attributionOf(turn.agent),
      userParts: turn.parts?.stored,
      passages: known.passages,
      parentId: transport.parentId,
    },
    transport.wire
  )
})

/**
 * Run one chat turn, buffered or streamed. A buffered turn ends with its
 * outcome; a streamed one once its stream was forwarded and, when it
 * completed, remembered. A provider failure fails the turn with its
 * `AiError`; a stream that cannot be opened, with why; a route's step, with
 * its cause.
 */
export const runChatTurn = Effect.fn('agents.chat.run-turn')(function* <
  I extends ChatTurnSubject,
  R,
>(
  turn: I,
  steps: ChatTurnSteps<I, R>,
  transport: ChatTurnTransport
): Effect.fn.Return<TurnOutcome<I>, ChatTurnError, ChatTurnRequirements | R> {
  if (transport.kind === 'buffered') return yield* answerChatTurn(turn, steps)
  yield* streamChatTurn(turn, steps, transport)
  return { kind: 'streamed' }
})
