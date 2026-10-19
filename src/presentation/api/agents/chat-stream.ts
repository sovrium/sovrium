/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Streaming AI chat helpers — `POST /api/ai/chat/stream`.
 *
 * Split out of `ai-chat.ts`, where the buffered `/api/ai/chat` route stays.
 *
 * Responsibilities:
 *  - Run the turn on the agent runtime and forward its events as TYPED SSE
 *    events: `content` and `reasoning` deltas, each `tool_call` and its
 *    `tool_result`, a final `done` carrying the session, the message id and
 *    the stop reason, then the `data: [DONE]` sentinel. A turn the provider
 *    cut short ends with neither.
 *  - Let the caller stop a turn (`POST /api/ai/chat/stop`): the turn is
 *    interrupted at its next step boundary — a tool call already running
 *    finishes — and the stream ends with `done { stopReason: 'stopped' }`,
 *    saving exactly what was streamed.
 *  - Pre-flight the provider stream with `Stream.peel` so config / provider
 *    errors AND the `AI_CHAT_STREAM_TIMEOUT` deadline can map to a non-200
 *    HTTP status (502/503/504) BEFORE `streamSSE` commits the response.
 *  - Forward chunks in real time via `runEffectSse`, the source stream's
 *    `Scope` kept alive across pre-flight and drain.
 *  - Persist the exchange once the stream reached its `done` (`onTerminate`),
 *    below the message the turn followed, under the ids `done` told, with one
 *    line per tool call the turn ran.
 *
 * `AI_CHAT_STREAM_TIMEOUT` deadlines TIME-TO-FIRST-CHUNK (the pre-flight
 * wait), not the whole exchange.
 */

import { Data, Deferred, Duration, Effect, Exit, Option, Scope, Sink, Stream } from 'effect'
import {
  runAgentTurn,
  type AgentTurnEvent,
  type AgentTurnRequirements,
  type AgentTurnSpec,
} from '@/application/use-cases/agents/agent-runtime'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { storedToolCalls } from '@/domain/models/app/agents/stored-tool-call-service'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { persistChatTurnDurably } from '@/presentation/api/agents/chat-durable-memory'
import { holdChatElicitation } from '@/presentation/api/agents/chat-elicitations'
import {
  createTurnEncoder,
  holdChatTurn,
  reachesTheWire,
  registerStop,
  stoppedDone,
  turnMeta,
  type HeldChatTurn,
  type WireEvent,
} from '@/presentation/api/agents/chat-stream-events'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { runEffectSse, type SseTerminationReason } from '@/presentation/api/runtime/effect-sse'
import type { AgentToolResult } from '@/application/use-cases/agents/agent-tool-call'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/**
 * Resolve the operator-tunable streaming-chat timeout budget.
 *
 * `AI_CHAT_STREAM_TIMEOUT` is the ms budget for the PRE-FLIGHT phase — the
 * window during which the provider must land its first chunk. A breach
 * surfaces as HTTP 504. Unset, empty, non-numeric, zero or negative: no
 * deadline, so "no timeout" reads uniformly with the unset case.
 */
const resolveStreamTimeoutMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number | undefined => {
  const raw = env.AI_CHAT_STREAM_TIMEOUT
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Marker raised when the provider's first chunk exceeds the deadline. */
class StreamTimeout extends Data.TaggedError('StreamTimeout')<{
  readonly timeoutMs: number
}> {}

/** Marker raised when the provider stream completes WITHOUT a first chunk. */
class EmptyProviderStream extends Data.TaggedError('EmptyProviderStream')<Record<string, never>> {}

/** Inputs for one streamed chat turn. */
export interface StreamTurnInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly message: string
  readonly sessionId: string
  readonly userId: string
  /** The turn itself, built like a buffered one (`chat-agent-turn.ts`). */
  readonly spec: AgentTurnSpec<StepRequirements>
  /** The declared agent the exchange is attributed to, when it is agent-bound. */
  readonly agentName?: string | undefined
  /** The question's parts, saved with it: references only. */
  readonly userParts?: HeldChatTurn['userParts']
  /**
   * The events to forward in place of a fresh run of `spec` — the rest of a
   * turn an approval paused, once its person decided. `spec` is still the
   * turn's own, for a later call held again.
   */
  readonly events?: Stream.Stream<AgentTurnEvent, unknown, TurnRequirements> | undefined
  /** The knowledge passages the turn was handed; `done` carries the ones its answer cites. */
  readonly passages?: HeldChatTurn['passages']
  /** The message the turn follows, which its exchange is saved below. */
  readonly parentId?: string | undefined
}

/** What a streamed turn needs from the server. */
type TurnRequirements = StepRequirements | AgentTurnRequirements

/**
 * Map a pre-flight failure to a non-200 JSON response. Mirrors the
 * non-streaming route's tagged-error → status mapping so the two surfaces
 * are predictable for the same provider failure modes.
 */
const mapPreflightError = (c: Context, err: unknown): Response => {
  const tagged = err as { readonly _tag?: string; readonly message?: string }
  if (tagged._tag === 'StreamTimeout') {
    return c.json(
      errorBody({
        error: 'The AI service timed out. Please try again.',
        code: ApiErrorCode.GATEWAY_TIMEOUT,
      }),
      504
    )
  }
  if (tagged._tag === 'AiConfigError') {
    return c.json(
      errorBody({
        error: tagged.message ?? 'AI service not configured',
        code: ApiErrorCode.SERVICE_UNAVAILABLE,
      }),
      503
    )
  }
  if (tagged._tag === 'EmptyProviderStream') {
    return c.json(
      errorBody({
        error: 'AI service returned an empty stream',
        code: ApiErrorCode.BAD_GATEWAY,
      }),
      502
    )
  }
  // Anything else is an upstream that answered badly: 502 + BAD_GATEWAY. The
  // three branches above keep `code` aligned with the status they send — a 504
  // is GATEWAY_TIMEOUT, a 502 is BAD_GATEWAY, and only the 503 config failure
  // is SERVICE_UNAVAILABLE, which is the one case where "wait and retry" is
  // honest advice. This mirrors `chatErrorCode` on the non-streaming route so
  // the same provider failure reads identically on both surfaces.
  return c.json(
    errorBody({
      error: tagged.message ?? 'AI provider error',
      code: ApiErrorCode.BAD_GATEWAY,
    }),
    502
  )
}

/**
 * Run the chat-stream Effect program and produce a streaming SSE Response.
 *
 * Phase 1 — pre-flight (BEFORE `streamSSE` commits 200):
 *   1. Open the turn on the agent runtime (`runAgentTurn`).
 *   2. Peel the first event with `Stream.peel(Sink.head())`, optionally
 *      gated by `Effect.timeoutOrElse({ AI_CHAT_STREAM_TIMEOUT })`.
 *   3. Map any failure (config error, provider error, timeout, empty
 *      stream) to a non-200 JSON response.
 *
 * ## Why this one scope is NOT `Effect.scoped` (a real exception)
 *
 * Standing rule E3 says a resource with a lifetime is a scoped layer or an
 * `Effect.acquireRelease`. This site cannot be either, and the reason is
 * structural rather than stylistic: the provider connection has to survive from
 * the pre-flight `runPromise` INTO the drain, and the drain is not inside any
 * Effect this function can wrap. `runEffectSse` returns a `Response`
 * synchronously from `streamSSE`, and Hono drains the body afterwards through a
 * SEPARATE root `Effect.runPromise` in `drainSource`. `Effect.scoped` here would
 * close the scope — and tear down the in-flight HTTP connection — the moment the
 * pre-flight resolved, which is before the first chunk reaches the wire.
 *
 * So the scope is created explicitly and handed off — but nothing has to be
 * remembered: there is no `Scope.close` per pre-flight exit (each would leak if
 * a later edit added another exit above it). The empty-stream case is folded
 * into the error channel and a single `Effect.onExit` closes the scope on ANY
 * pre-flight failure, so the only other close is the deliberate hand-off in
 * `onTerminate`.
 *
 * Making this a true `Effect.scoped` means teaching `runEffectSse` to own a
 * scope across the commit boundary — a change to the shared SSE bridge that all
 * four of its consumers would inherit, and a different piece of work.
 *
 * Phase 2 — drain (AFTER 200 is committed):
 *   4. Prepend the peeled head, so chunk-1 is the first SSE event.
 *   5. `Stream.tap` accumulates the answer and observes the terminal `done`.
 *   6. `onTerminate` persists ONLY when `reason === 'completed'` AND `done`
 *      was observed, and closes the held `Scope` for every reason.
 */
/**
 * The turn as the wire carries it: interrupted by a stop, which then ends it
 * as `done { stopped }`, and each `done` followed by the `[DONE]` sentinel.
 */
const stoppableTurn = (
  input: StreamTurnInput,
  stop: Deferred.Deferred<void>
): Stream.Stream<WireEvent, unknown, TurnRequirements> =>
  Stream.concat(
    (input.events ?? runAgentTurn(input.spec)).pipe(Stream.interruptWhen(Deferred.await(stop))),
    Stream.suspend(() => (Deferred.isDoneUnsafe(stop) ? Stream.succeed(stoppedDone) : Stream.empty))
  ).pipe(
    Stream.filter(reachesTheWire),
    Stream.flatMap((event) =>
      event.type === 'done'
        ? Stream.make<WireEvent[]>(event, { type: 'sentinel' })
        : Stream.succeed(event)
    )
  )

export const buildStreamResponse = async (
  c: Context,
  input: StreamTurnInput
): Promise<Response> => {
  const timeoutMs = resolveStreamTimeoutMs()
  const meta = turnMeta(input)

  // The stop signal, registered before anything runs so a pre-flight stop is not lost.
  const { stop, release } = registerStop(input)
  // Externally-managed scope: open across runPromise calls, so the provider
  // connection survives into the drain.
  const scope = await Effect.runPromise(Scope.make())

  const turn = stoppableTurn(input, stop)

  // Pre-flight: open the turn and peel its first event (with optional timeout).
  const peelEffect = Stream.peel(turn, Sink.head<WireEvent>())

  // EFFECT 4: `Scope.extend` -> `Scope.provide` (migration/v3-to-v4.md:14624),
  // same data-first shape. NOT `Scope.use`, which reads like the obvious choice
  // and would CLOSE the scope when the pre-flight effect exits — releasing the
  // provider connection before the drain that depends on it.
  const withScope = Scope.provide(peelEffect, scope)
  const provided = provideDomain(c, withScope)
  const withTimeout =
    timeoutMs === undefined
      ? provided
      : provided.pipe(
          // EFFECT 4: `timeoutFail` -> `timeoutOrElse` + `Effect.fail`
          // (migration/v3-to-v4.md:9833).
          Effect.timeoutOrElse({
            duration: Duration.millis(timeoutMs),
            orElse: () => Effect.fail(new StreamTimeout({ timeoutMs })),
          })
        )
  const preflight = withTimeout.pipe(
    // An empty stream is a pre-flight FAILURE dressed as a success with no
    // head; folding it into the error channel lets the one finalizer below
    // cover it.
    Effect.flatMap(([headOpt, rest]) =>
      Option.isNone(headOpt)
        ? Effect.fail(new EmptyProviderStream({}))
        : Effect.succeed([headOpt.value, rest] as const)
    ),
    // THE one place the scope's fate is decided: a failed pre-flight releases
    // the provider connection; a successful one hands it to the drain.
    Effect.onExit((exit) => (Exit.isSuccess(exit) ? Effect.void : Scope.close(scope, Exit.void)))
  )
  const result = await Effect.runPromise(Effect.result(preflight))

  if (result._tag === 'Failure') {
    release()
    logError('[ai] chat-stream pre-flight failed', result.failure)
    return mapPreflightError(c, result.failure)
  }

  const [head, rest] = result.success
  const accumulator = buildPersistAccumulator(input, head)
  const instrumented = Stream.tap(rest, accumulator.tap)
  const prepended = Stream.concat(Stream.succeed(head), instrumented)

  // Encoding renders the answer, which highlights its code asynchronously, so it
  // is mapped onto the stream as an Effect, one event at a time, in order.
  return runEffectSse(c, Stream.mapEffect(prepended, createTurnEncoder(meta)), (chunk) => chunk, {
    onTerminate: buildOnTerminate(
      scope,
      { ...input, ids: meta.ids },
      { snapshot: accumulator.snapshot, release }
    ),
  })
}

/** What the drain saw of the turn, for what is saved once it ends. */
interface TurnSnapshot {
  readonly assembled: string
  readonly sawDone: boolean
  /** A call was held for approval, or a question asked: the turn is not over, and nothing is saved yet. */
  readonly paused: boolean
  readonly toolResults: ReadonlyArray<AgentToolResult>
}

/** The turn a pause keeps, so the person's answer can go on with it. */
const heldTurn = (input: StreamTurnInput): HeldChatTurn => ({
  userId: input.userId,
  sessionId: input.sessionId,
  message: input.message,
  agentName: input.agentName,
  userParts: input.userParts,
  spec: input.spec,
  passages: input.passages,
  parentId: input.parentId,
})

/**
 * The persistence accumulator: the answer text streamed so far (seeded from the
 * peeled head), whether the turn reached its `done`, and whether a call was
 * held for approval or a question asked — whose turn is then remembered, so
 * the person's decision or answer can go on with it.
 */
const buildPersistAccumulator = (
  input: StreamTurnInput,
  head: WireEvent
): {
  readonly tap: (event: WireEvent) => Effect.Effect<void>
  readonly snapshot: () => TurnSnapshot
} => {
  let assembled = ''
  let sawDone = false
  let paused = false
  let toolResults: ReadonlyArray<AgentToolResult> = []
  const observe = (event: WireEvent): void => {
    if (event.type === 'tool_result') toolResults = [...toolResults, event]
    if (event.type === 'content') {
      assembled += event.delta
    } else if (event.type === 'done') {
      sawDone = true
    } else if (event.type === 'tool_result' && event.approvalId !== undefined) {
      paused = true
      holdChatTurn(event.approvalId, heldTurn(input))
    } else if (event.type === 'tool_result' && event.elicitation !== undefined) {
      paused = true
      holdChatElicitation({ ...heldTurn(input), elicitation: event.elicitation })
    }
  }
  observe(head)
  return {
    tap: (event) => Effect.sync(() => observe(event)),
    snapshot: () => ({ assembled, sawDone, paused, toolResults }),
  }
}

/**
 * Build the bridge's `onTerminate` handler. Closes the externally-held
 * `Scope` and releases the stop registration for every termination reason,
 * and persists the streamed answer ONLY when the drain resolved cleanly AND
 * the turn reached its `done` — a stopped turn included, with what it streamed.
 */
const buildOnTerminate = (
  // EFFECT 4: `Scope.CloseableScope` -> `Scope.Closeable` (migration:14612).
  scope: Scope.Closeable,
  input: StreamTurnInput & { readonly ids: { readonly question: string; readonly answer: string } },
  state: {
    readonly snapshot: () => TurnSnapshot
    readonly release: () => void
  }
): ((reason: SseTerminationReason) => Promise<void>) => {
  return async (reason) => {
    state.release()
    await Effect.runPromise(Scope.close(scope, Exit.void)).catch((err) => {
      logError('[chat-stream] scope close failed', err)
    })

    if (reason !== 'completed') return
    const { assembled, sawDone, paused, toolResults } = state.snapshot()
    // A paused turn is saved once its person decided, with the answer that followed.
    if (!sawDone || paused) return
    // Await persistence so the HTTP response stays "open" until the row is
    // committed — STREAM-008's read-after-write would otherwise race.
    await persistChatTurnDurably(input.services, {
      userId: input.userId,
      sessionId: input.sessionId,
      userMessage: input.message,
      assistantReply: assembled,
      userParts: input.userParts,
      ...(input.agentName !== undefined && { agentName: input.agentName }),
      ...(toolResults.length > 0 && { assistantToolCalls: storedToolCalls(toolResults) }),
      parentId: input.parentId,
      ids: input.ids,
    }).catch((err) => {
      // Best-effort — log but never throw out of onTerminate.
      logError('[chat-stream] persistChatTurnDurably failed', err)
    })
  }
}
