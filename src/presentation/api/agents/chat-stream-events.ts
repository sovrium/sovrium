/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The wire of a streamed chat turn: each runtime event as a TYPED SSE event,
 * the registry through which `POST /api/ai/chat/stop` reaches the turn a
 * caller has in flight on a session, and the turns paused on a call held for
 * approval, which `POST /api/ai/chat/approvals/:id` goes on with.
 */

import { Deferred, Effect, Exit } from 'effect'
import { ASK_USER_TOOL_NAME } from '@/domain/models/app/agents/ask-user-service'
import { chatCallerKey } from '@/presentation/api/agents/chat-conversation-store'
import { turnCitations } from '@/presentation/api/agents/chat-knowledge-citations'
import {
  readerArguments,
  toolInputPreview,
  toolOutputPreview,
  turnReaderColumns,
  type ReaderColumns,
} from '@/presentation/api/agents/chat-tool-preview'
import { renderChatAnswerHtml } from '@/presentation/render/markdown/chat-answer-markdown'
import type { AiMessagePart } from '@/application/ports/repositories/ai/ai-memory-repository'
import type { PendingElicitation } from '@/application/ports/services/agent-approval-store'
import type { ChatFinishReason } from '@/application/ports/services/ai-service'
import type { AgentTurnEvent, AgentTurnSpec } from '@/application/use-cases/agents/agent-runtime'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type {
  chatToolCallEventSchema,
  chatToolResultEventSchema,
} from '@/domain/models/api/ai/chat'
import type { KnowledgePassage } from '@/domain/models/app/agents/knowledge-citation-service'
import type { EncodedChunk } from '@/presentation/api/runtime/effect-sse'
import type { Context } from 'hono'

/** One event on the wire: a turn event, or the closing sentinel. */
export type WireEvent = AgentTurnEvent | { readonly type: 'sentinel' }

/**
 * Whether the window is sent `event`. `ask_user` is not a tool line: its call
 * never reaches the wire, and its result only as the `elicit` event of a
 * question asked — a refused one is the model's business alone.
 */
export const reachesTheWire = (event: WireEvent): boolean =>
  !(
    (event.type === 'tool_call' || event.type === 'tool_result') &&
    event.name === ASK_USER_TOOL_NAME &&
    (event.type === 'tool_call' || event.elicitation === undefined)
  )

/** The stop reason a client reads, by the runtime's finish reason. */
const STOP_REASONS: Readonly<Record<ChatFinishReason, string>> = {
  stop: 'end',
  'tool-calls': 'end',
  length: 'length',
  'tool-limit': 'tool-limit',
  cancelled: 'stopped',
  error: 'error',
}

/**
 * How often, at most, a `content` event carries the answer so far rendered as
 * Markdown. Every delta carrying the whole answer again would make a long
 * answer cost its length squared on the wire; the `done` event always carries
 * the final rendering, so the window's last word is never a stale snapshot.
 */
const HTML_SNAPSHOT_INTERVAL_MS = 150

/** `{ citations }` when the answer cites any of the passages its turn was handed. */
const withCitations = (
  citations: ReturnType<typeof turnCitations>
): { readonly citations?: ReturnType<typeof turnCitations> } =>
  citations === undefined ? {} : { citations }

/**
 * A tool call as the wire carries it: the model's arguments without a value
 * the reader may not read, and the `input` preview of those same arguments.
 * The model itself keeps what it wrote; only the wire is narrowed.
 */
const toolCallPayload = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_call' }>,
  readerColumns: ReaderColumns
): typeof chatToolCallEventSchema.Encoded => {
  const input = toolInputPreview(event.name, event.arguments, readerColumns)
  return {
    id: event.id,
    name: event.name,
    arguments: readerArguments(event.name, event.arguments, readerColumns),
    input: input.text,
    ...(input.truncated && { inputTruncated: true as const }),
  }
}

/**
 * A tool call's result as the wire carries it: what the model was handed —
 * read as the reader, so it holds only what she may read — and the `output`
 * preview of that same result.
 */
const toolResultPayload = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_result' }>
): typeof chatToolResultEventSchema.Encoded => {
  const output = toolOutputPreview(event.content)
  return {
    id: event.id,
    name: event.name,
    ok: event.outcome === 'ok',
    outcome: event.outcome,
    content: event.content,
    ...(event.approvalId !== undefined && { approvalId: event.approvalId }),
    output: output.text,
    ...(output.truncated && { outputTruncated: true as const }),
  }
}

/**
 * A question the agent asks the person (`ask_user`), or an external MCP server
 * asks through it, as the wire carries it: its id, the question and the flat
 * form, and for a server's question the declared name of the server asking —
 * never the turn it pauses.
 */
const elicitPayload = (elicitation: PendingElicitation): Readonly<Record<string, unknown>> => ({
  elicitationId: elicitation.id,
  message: elicitation.message,
  requestedSchema: elicitation.requestedSchema,
  ...(elicitation.server !== undefined && { server: elicitation.server }),
})

/** A tool call on the wire. */
const toolCallChunk = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_call' }>,
  readerColumns: ReaderColumns
): EncodedChunk => ({
  kind: 'data',
  event: 'tool_call',
  payload: toolCallPayload(event, readerColumns),
})

/** A tool call's result on the wire — or, for a question asked, the `elicit` event. */
const toolResultChunk = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_result' }>
): EncodedChunk =>
  event.elicitation === undefined
    ? { kind: 'data', event: 'tool_result', payload: toolResultPayload(event) }
    : { kind: 'data', event: 'elicit', payload: elicitPayload(event.elicitation) }

/** What the encoder of one turn knows of it besides its events. */
interface TurnEncoderMeta {
  readonly sessionId: string
  /** The ids the question and its answer are saved under. */
  readonly ids: { readonly question: string; readonly answer: string }
  readonly passages: ReadonlyArray<KnowledgePassage>
  /** The fields the person reading may read, which narrow each call's `input`. */
  readonly readerColumns: ReaderColumns
}

/**
 * What the encoder of a turn starts from: the ids the exchange is saved under,
 * the passages it may cite, and the fields the person the turn answers may
 * read, which narrow each call's preview.
 */
export const turnMeta = (input: {
  readonly sessionId: string
  readonly passages?: ReadonlyArray<KnowledgePassage> | undefined
  readonly spec: AgentTurnSpec<StepRequirements>
}): TurnEncoderMeta => ({
  sessionId: input.sessionId,
  ids: { question: crypto.randomUUID(), answer: crypto.randomUUID() },
  passages: input.passages ?? [],
  readerColumns: turnReaderColumns(input.spec),
})

/** The `done` event: the ids, the stop reason, the final rendering, citations and usage. */
const doneChunk = (input: {
  readonly meta: TurnEncoderMeta
  readonly answer: string
  readonly html: string
  readonly awaitingInput: boolean
  readonly event: Extract<WireEvent, { readonly type: 'done' }>
}): EncodedChunk => ({
  kind: 'data',
  event: 'done',
  payload: {
    sessionId: input.meta.sessionId,
    messageId: input.meta.ids.answer,
    questionId: input.meta.ids.question,
    stopReason: input.awaitingInput ? 'awaiting_input' : STOP_REASONS[input.event.finishReason],
    ...(input.html.length > 0 && { html: input.html }),
    ...withCitations(turnCitations(input.answer, input.meta.passages)),
    ...(input.event.usage !== undefined && { usage: input.event.usage }),
  },
})

/**
 * The encoder of ONE streamed turn: each event as a typed SSE event. The
 * answer and the reasoning carry `{ text }`, and an answer delta now and then
 * `html` too, the whole answer so far rendered; a tool call its name,
 * arguments and `input` preview; its result whether it ran (`ok`), its
 * `outcome`, what the model was handed and its `output` preview; `done` the
 * session, the message id, the stop reason and the answer's final `html`.
 *
 * A question the agent asked the person is the `elicit` event in place of its
 * tool result (the stream never carries `ask_user`'s own call).
 *
 * Stateful on purpose, one per response: it keeps the answer so far for the
 * rendering, and remembers a call held for approval, or a question asked, so
 * the `done` that follows reads `awaiting_input` — the turn is waiting on the
 * person, not finished.
 *
 * Each chunk is an Effect because rendering the answer highlights its code,
 * which is asynchronous (`chat-answer-markdown.ts`); the stream maps its
 * events through the encoder one at a time, so the order on the wire is the
 * order of the turn.
 */
export const createTurnEncoder = (
  meta: TurnEncoderMeta
): ((event: WireEvent) => Effect.Effect<EncodedChunk>) => {
  let answer = ''
  let snapshotAt = 0
  let awaitingInput = false
  const content = (delta: string): Effect.Effect<EncodedChunk> => {
    answer += delta
    const now = Date.now()
    const snapshot = now - snapshotAt >= HTML_SNAPSHOT_INTERVAL_MS
    if (!snapshot)
      return Effect.succeed({ kind: 'data', event: 'content', payload: { text: delta } })
    snapshotAt = now
    return Effect.map(renderChatAnswerHtml(answer), (html) => ({
      kind: 'data',
      event: 'content',
      payload: { text: delta, html },
    }))
  }
  const done = (
    event: Extract<WireEvent, { readonly type: 'done' }>
  ): Effect.Effect<EncodedChunk> =>
    Effect.map(renderChatAnswerHtml(answer), (html) =>
      doneChunk({ meta, answer, html, awaitingInput, event })
    )
  return (event) => {
    switch (event.type) {
      case 'sentinel':
        return Effect.succeed({ kind: 'terminal' })
      case 'content':
        return content(event.delta)
      case 'reasoning':
        return Effect.succeed({ kind: 'data', event: 'reasoning', payload: { text: event.delta } })
      case 'tool_call':
        return Effect.succeed(toolCallChunk(event, meta.readerColumns))
      case 'tool_result':
        awaitingInput ||= event.outcome === 'pending-approval' || event.outcome === 'pending-input'
        return Effect.succeed(toolResultChunk(event))
      case 'done':
        return done(event)
    }
  }
}

// ---------------------------------------------------------------------------
// Held turns
// ---------------------------------------------------------------------------

/**
 * A streamed turn paused on a call held for approval: whose it is, on which
 * session, and the turn itself, so the decision can go on with it.
 */
export interface HeldChatTurn {
  readonly userId: string
  readonly sessionId: string
  /** The question the turn answers, saved with the answer once it ends. */
  readonly message: string
  readonly agentName?: string | undefined
  /** The question's parts, when it was sent as parts: references only. */
  readonly userParts?: ReadonlyArray<AiMessagePart> | undefined
  readonly spec: AgentTurnSpec<StepRequirements>
  /** The knowledge passages the turn was handed, so its rest cites them too. */
  readonly passages?: ReadonlyArray<KnowledgePassage> | undefined
  /** The message the turn follows, which its exchange is saved below once it ends. */
  readonly parentId?: string | undefined
}

/**
 * The held turns, by approval id. Process state, like the continuation the
 * approval store keeps: a restart forgets both, and the decision then finds
 * nothing to go on with. Bounded, oldest first out, so approvals nobody ever
 * decides cannot grow it without end.
 */
const heldTurns = new Map<string, HeldChatTurn>()

/** The most paused turns one registry holds — approvals and questions alike. */
export const MAX_HELD_TURNS = 1000

/**
 * Remember `value` under `key` in a registry of paused turns, bounded to
 * {@link MAX_HELD_TURNS}: past it, the oldest entry goes first. The one shape
 * both registries share — the turns held for an approval, and the questions
 * (`chat-elicitations.ts`).
 */
export const rememberHeld = <V>(registry: Map<string, V>, key: string, value: V): void => {
  registry.set(key, value)
  if (registry.size > MAX_HELD_TURNS) {
    const oldest = registry.keys().next().value
    if (oldest !== undefined) registry.delete(oldest)
  }
}

/** Remember the turn a call held for approval paused. */
export const holdChatTurn = (approvalId: string, turn: HeldChatTurn): void =>
  rememberHeld(heldTurns, approvalId, turn)

/**
 * Take the turn `approvalId` paused, for its own person only. Anyone else finds
 * nothing, and the turn stays held for her (S1: the approval does not exist
 * for them).
 */
export const takeHeldChatTurn = (approvalId: string, userId: string): HeldChatTurn | undefined => {
  const held = heldTurns.get(approvalId)
  if (held === undefined || held.userId !== userId) return undefined
  heldTurns.delete(approvalId)
  return held
}

// ---------------------------------------------------------------------------
// Stop
// ---------------------------------------------------------------------------

/** The turns in flight, by caller and session — what `POST /api/ai/chat/stop` signals. */
const inFlight = new Map<string, Deferred.Deferred<void>>()

const turnKey = (userId: string, sessionId: string): string => JSON.stringify([userId, sessionId])

/**
 * Stop the caller's turn in flight on `sessionId`. `false` when there is none —
 * already finished, never started, or someone else's. Idempotent: a second
 * stop of the same turn finds it already stopping.
 */
export const stopChatTurn = (userId: string, sessionId: string): boolean => {
  const signal = inFlight.get(turnKey(userId, sessionId))
  if (signal === undefined) return false
  Deferred.doneUnsafe(signal, Exit.void)
  return true
}

/**
 * Register a turn's stop signal; `release` forgets it once the turn is over.
 * It is keyed by {@link chatCallerKey} — a signed-out caller by her browser —
 * which is how `chat-stop-route.ts` looks it up.
 */
export const registerStop = (
  c: Context,
  input: { readonly userId: string; readonly sessionId: string }
): { readonly stop: Deferred.Deferred<void>; readonly release: () => void } => {
  const key = turnKey(chatCallerKey(c, input.userId), input.sessionId)
  const stop = Deferred.makeUnsafe<void>()
  inFlight.set(key, stop)
  return {
    stop,
    release: () => {
      if (inFlight.get(key) === stop) inFlight.delete(key)
    },
  }
}

/** The `done` a stopped turn ends with. */
export const stoppedDone: WireEvent = {
  type: 'done',
  model: '',
  finishReason: 'cancelled',
  reply: '',
  steps: 0,
}
