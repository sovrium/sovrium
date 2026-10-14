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

import { Deferred, Exit } from 'effect'
import { ASK_USER_TOOL_NAME } from '@/domain/models/app/agents/ask-user-service'
import { turnCitations } from '@/presentation/api/agents/chat-knowledge-citations'
import { renderChatAnswerHtml } from '@/presentation/render/markdown/chat-answer-markdown'
import type { AiMessagePart } from '@/application/ports/repositories/ai/ai-memory-repository'
import type { PendingElicitation } from '@/application/ports/services/agent-approval-store'
import type { ChatFinishReason } from '@/application/ports/services/ai-service'
import type { AgentTurnEvent, AgentTurnSpec } from '@/application/use-cases/agents/agent-runtime'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type { KnowledgePassage } from '@/domain/models/app/agents/knowledge-citation-service'
import type { EncodedChunk } from '@/presentation/api/runtime/effect-sse'

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

/** A tool call as the wire carries it. */
const toolCallPayload = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_call' }>
): Readonly<Record<string, unknown>> => ({
  id: event.id,
  name: event.name,
  arguments: event.arguments,
})

/** A tool call's result as the wire carries it. */
const toolResultPayload = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_result' }>
): Readonly<Record<string, unknown>> => ({
  id: event.id,
  name: event.name,
  ok: event.outcome === 'ok',
  outcome: event.outcome,
  content: event.content,
  ...(event.approvalId !== undefined && { approvalId: event.approvalId }),
})

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

/** A tool call's result on the wire — or, for a question asked, the `elicit` event. */
const toolResultChunk = (
  event: Extract<AgentTurnEvent, { readonly type: 'tool_result' }>
): EncodedChunk =>
  event.elicitation === undefined
    ? { kind: 'data', event: 'tool_result', payload: toolResultPayload(event) }
    : { kind: 'data', event: 'elicit', payload: elicitPayload(event.elicitation) }

/**
 * The encoder of ONE streamed turn: each event as a typed SSE event. The
 * answer and the reasoning carry `{ text }`, and an answer delta now and then
 * `html` too, the whole answer so far rendered; a tool call its name and
 * arguments; its result whether it ran (`ok`), its `outcome` and what the model
 * was handed; `done` the session, the message id, the stop reason and the
 * answer's final `html`.
 *
 * A question the agent asked the person is the `elicit` event in place of its
 * tool result (the stream never carries `ask_user`'s own call).
 *
 * Stateful on purpose, one per response: it keeps the answer so far for the
 * rendering, and remembers a call held for approval, or a question asked, so
 * the `done` that follows reads `awaiting_input` — the turn is waiting on the
 * person, not finished.
 */
export const createTurnEncoder = (meta: {
  readonly sessionId: string
  /** The ids the question and its answer are saved under. */
  readonly ids: { readonly question: string; readonly answer: string }
  readonly passages: ReadonlyArray<KnowledgePassage>
}): ((event: WireEvent) => EncodedChunk) => {
  let answer = ''
  let snapshotAt = 0
  let awaitingInput = false
  const content = (delta: string): EncodedChunk => {
    answer += delta
    const now = Date.now()
    const snapshot = now - snapshotAt >= HTML_SNAPSHOT_INTERVAL_MS
    if (snapshot) snapshotAt = now
    return {
      kind: 'data',
      event: 'content',
      payload: { text: delta, ...(snapshot && { html: renderChatAnswerHtml(answer) }) },
    }
  }
  const done = (event: Extract<WireEvent, { readonly type: 'done' }>): EncodedChunk => ({
    kind: 'data',
    event: 'done',
    payload: {
      sessionId: meta.sessionId,
      messageId: meta.ids.answer,
      questionId: meta.ids.question,
      stopReason: awaitingInput ? 'awaiting_input' : STOP_REASONS[event.finishReason],
      ...(answer.length > 0 && { html: renderChatAnswerHtml(answer) }),
      ...withCitations(turnCitations(answer, meta.passages)),
      ...(event.usage !== undefined && { usage: event.usage }),
    },
  })
  return (event) => {
    switch (event.type) {
      case 'sentinel':
        return { kind: 'terminal' }
      case 'content':
        return content(event.delta)
      case 'reasoning':
        return { kind: 'data', event: 'reasoning', payload: { text: event.delta } }
      case 'tool_call':
        return { kind: 'data', event: 'tool_call', payload: toolCallPayload(event) }
      case 'tool_result':
        awaitingInput ||= event.outcome === 'pending-approval' || event.outcome === 'pending-input'
        return toolResultChunk(event)
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

/** Register a turn's stop signal; `release` forgets it once the turn is over. */
export const registerStop = (input: {
  readonly userId: string
  readonly sessionId: string
}): { readonly stop: Deferred.Deferred<void>; readonly release: () => void } => {
  const key = turnKey(input.userId, input.sessionId)
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
