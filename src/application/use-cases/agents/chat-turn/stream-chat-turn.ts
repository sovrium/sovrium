/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A streamed chat turn, forwarded event by event: the stream is a resource of
 * the program that runs the turn.
 *
 * The program opens the turn, peels its first event (bounded by
 * `AI_CHAT_STREAM_TIMEOUT`, so a slow or failing provider is still answered
 * with an error status before anything is streamed), then hands the rest to
 * whoever forwards it through a queue the program owns, and waits for the
 * forwarding to end. Everything the stream holds — the provider connection,
 * a tool call in flight, the queue's producer — is acquired in the program's
 * scope: when the forwarding ends, however it ends (the turn's last event
 * sent, the client gone, the stream's lifetime spent), the program's scope
 * closes and releases them, the producer first.
 *
 * Nothing that must outlive the request is forked here. A turn paused on an
 * approval or a question is remembered as data (`ChatTurnWire.pause`), and the
 * person's answer resumes it on a request of its own; an external MCP call
 * paused on a question lives in the MCP client's own server-scoped state.
 */

import { Data, Deferred, Duration, Effect, Option, Ref, Sink, Stream } from 'effect'
import { ProcessEnv } from '@/application/ports/services/process-env'
import {
  runAgentTurn,
  type AgentTurnEvent,
  type AgentTurnRequirements,
  type AgentTurnSpec,
} from '@/application/use-cases/agents/agent-runtime'
import { storedToolCalls } from '@/domain/models/app/agents/stored-tool-call-service'
import { resolveChatStreamTimeoutMs } from '@/domain/models/process-env/ai/ai-chat-turn'
import { rememberChatTurn } from './durable-memory'
import type {
  AiMemoryRepository,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import type { AiError } from '@/application/ports/services/ai-service'
import type { AgentToolResult } from '@/application/use-cases/agents/agent-tool-call'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type { KnowledgePassage } from '@/domain/models/app/agents/knowledge-citation-service'

/** The provider's first event did not arrive within `AI_CHAT_STREAM_TIMEOUT`. */
export class StreamTimeout extends Data.TaggedError('StreamTimeout')<{
  readonly timeoutMs: number
}> {}

/** The provider's stream ended before its first event. */
export class EmptyProviderStream extends Data.TaggedError('EmptyProviderStream')<
  Record<string, never>
> {}

/** Why a stream could not be opened: each one is answered with an error status, nothing streamed. */
export type ChatStreamOpenError = AiError | StreamTimeout | EmptyProviderStream

/** A turn event as it is forwarded, or the closing marker the forwarder adds after `done`. */
export type ForwardedTurnEvent = AgentTurnEvent | { readonly type: 'sentinel' }

/** How the forwarding of a stream ended. */
export type TurnStreamEnd = 'completed' | 'aborted' | 'timeout'

/** What a streamed turn needs from the server. */
export type StreamedTurnRequirements = StepRequirements | AgentTurnRequirements

/** One streamed turn: what it answers, how it runs, and what its exchange is saved with. */
export interface StreamedTurn {
  readonly userId: string
  readonly sessionId: string
  /** The question, saved with the answer once the turn ends. */
  readonly message: string
  readonly spec: AgentTurnSpec<StepRequirements>
  /** The declared agent the exchange is attributed to. */
  readonly agentName?: string | undefined
  /** The question's parts, saved with it: references only. */
  readonly userParts?: ReadonlyArray<AiMessagePart> | undefined
  /** The knowledge passages the turn was handed; its answer cites them. */
  readonly passages?: ReadonlyArray<KnowledgePassage> | undefined
  /** The message the turn follows, which its exchange is saved below. */
  readonly parentId?: string | undefined
  /**
   * The events to forward in place of a fresh run of `spec`: the rest of a
   * turn a person's decision or answer resumed. `spec` stays the turn's own,
   * for a later call paused again.
   */
  readonly resumed?: Stream.Stream<AgentTurnEvent, AiError, StreamedTurnRequirements> | undefined
}

/** The ids the question and the answer are told and saved under. */
export interface TurnMessageIds {
  readonly question: string
  readonly answer: string
}

/** A stream the program opened: its first event, the rest, and how to tell it the forwarding ended. */
export interface OpenedTurnStream {
  readonly turn: StreamedTurn
  readonly head: ForwardedTurnEvent
  /** Every event after `head`, read from the program's queue. */
  readonly events: Stream.Stream<ForwardedTurnEvent, AiError>
  /** Tell the program the forwarding ended; it then saves what it should and releases the stream. */
  readonly end: (reason: TurnStreamEnd) => void
}

/** Where a streamed turn's events go: the route that forwards them. */
export interface ChatTurnWire {
  /** The turn's events as the forwarder carries them (its stop signal, its closing marker). */
  readonly frame: <E, R>(
    events: Stream.Stream<AgentTurnEvent, E, R>
  ) => Stream.Stream<ForwardedTurnEvent, E, R>
  /** Hand the opened stream over; answers the ids the forwarder told the client. */
  readonly open: (opened: OpenedTurnStream) => Effect.Effect<TurnMessageIds>
  /** Remember a turn paused on a call held for approval, or on a question to the person. */
  readonly pause: (result: AgentToolResult, turn: StreamedTurn) => Effect.Effect<void>
}

/** How many events the producer may run ahead of the forwarder. */
const FORWARD_BUFFER = 16

/** What the forwarded events said, for what is saved once the stream ends. */
interface TurnTally {
  readonly assembled: string
  readonly sawDone: boolean
  /** A call was held or a question asked: the turn is not over, and nothing is saved yet. */
  readonly paused: boolean
  readonly toolResults: ReadonlyArray<AgentToolResult>
}

const EMPTY_TALLY: TurnTally = { assembled: '', sawDone: false, paused: false, toolResults: [] }

/** The result that pauses the turn, when `event` is one. */
const pausingResult = (event: ForwardedTurnEvent): AgentToolResult | undefined =>
  event.type === 'tool_result' &&
  (event.approvalId !== undefined || event.elicitation !== undefined)
    ? event
    : undefined

const tallyEvent = (tally: TurnTally, event: ForwardedTurnEvent): TurnTally => {
  if (event.type === 'content') return { ...tally, assembled: tally.assembled + event.delta }
  if (event.type === 'done') return { ...tally, sawDone: true }
  if (event.type !== 'tool_result') return tally
  return {
    ...tally,
    toolResults: [...tally.toolResults, event],
    paused: tally.paused || pausingResult(event) !== undefined,
  }
}

/** Open the turn and take its first event, within the first-chunk deadline. */
const peelFirstEvent = <R>(
  source: Stream.Stream<ForwardedTurnEvent, AiError, R>,
  timeoutMs: number | undefined
) => {
  const peeled = Stream.peel(source, Sink.head<ForwardedTurnEvent>())
  const bounded =
    timeoutMs === undefined
      ? peeled
      : peeled.pipe(
          Effect.timeoutOrElse({
            duration: Duration.millis(timeoutMs),
            orElse: () => Effect.fail(new StreamTimeout({ timeoutMs })),
          })
        )
  return bounded.pipe(
    Effect.flatMap(([head, rest]) =>
      Option.isNone(head)
        ? Effect.fail(new EmptyProviderStream({}))
        : Effect.succeed([head.value, rest] as const)
    )
  )
}

/** Save the streamed exchange once its stream completed on the turn's `done`, unpaused. */
const saveForwardedTurn = (
  turn: StreamedTurn,
  ended: { readonly reason: TurnStreamEnd; readonly tally: TurnTally; readonly ids: TurnMessageIds }
): Effect.Effect<void, never, AiMemoryRepository> => {
  const { reason, tally, ids } = ended
  // A paused turn is saved once its person decided, with the answer that followed.
  if (reason !== 'completed' || !tally.sawDone || tally.paused) return Effect.void
  return rememberChatTurn({
    userId: turn.userId,
    sessionId: turn.sessionId,
    userMessage: turn.message,
    assistantReply: tally.assembled,
    userParts: turn.userParts,
    ...(turn.agentName !== undefined && { agentName: turn.agentName }),
    ...(tally.toolResults.length > 0 && {
      assistantToolCalls: storedToolCalls(tally.toolResults),
    }),
    parentId: turn.parentId,
    ids,
  })
}

/**
 * Run a streamed turn and forward its events through `wire`, saving the
 * exchange once the forwarding completed on the turn's `done`. Fails, with
 * nothing forwarded, when the stream cannot be opened.
 */
export const forwardChatTurnStream = Effect.fn('agents.chat.forward-turn-stream')(function* (
  turn: StreamedTurn,
  wire: ChatTurnWire
): Effect.fn.Return<void, ChatStreamOpenError, StreamedTurnRequirements | AiMemoryRepository> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const timeoutMs = resolveChatStreamTimeoutMs(yield* ProcessEnv)
      const source = wire.frame(turn.resumed ?? runAgentTurn(turn.spec))
      const [head, rest] = yield* peelFirstEvent(source, timeoutMs)
      const tally = yield* Ref.make(tallyEvent(EMPTY_TALLY, head))
      const observe = (event: ForwardedTurnEvent): Effect.Effect<void> => {
        const pausing = pausingResult(event)
        return pausing === undefined ? Effect.void : wire.pause(pausing, turn)
      }
      yield* observe(head)
      const observed = Stream.tap(rest, (event) =>
        Ref.update(tally, (current) => tallyEvent(current, event)).pipe(
          Effect.andThen(observe(event))
        )
      )
      // The producer runs in this scope: closing it interrupts the turn, then
      // releases the provider connection the peel holds.
      const queue = yield* Stream.toQueue(observed, { capacity: FORWARD_BUFFER })
      const ended = yield* Deferred.make<TurnStreamEnd>()
      const ids = yield* wire.open({
        turn,
        head,
        events: Stream.fromQueue(queue),
        end: (reason) => Deferred.doneUnsafe(ended, Effect.succeed(reason)),
      })
      const reason = yield* Deferred.await(ended)
      yield* saveForwardedTurn(turn, { reason, tally: yield* Ref.get(tally), ids })
    })
  )
})
