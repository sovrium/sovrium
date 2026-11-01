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
 *  - Answer a stream that could not be opened — a provider or config error,
 *    an empty stream, the `AI_CHAT_STREAM_TIMEOUT` first-chunk deadline — with
 *    a non-200 status (502/503/504) BEFORE `streamSSE` commits the response.
 *  - Forward the events the turn's program hands over in real time via
 *    `runEffectSse`, and tell the program how the forwarding ended: it saves
 *    the exchange once the stream reached its `done`, below the message the
 *    turn followed, under the ids `done` told, then releases the stream.
 *
 * The stream is a resource of the turn's program
 * (`application/use-cases/agents/chat-turn/stream-chat-turn.ts`), which runs
 * inside the handler's one program (`runHandlerStream`); this module only
 * frames and forwards.
 */

import { Deferred, Effect, Stream } from 'effect'
import { EmptyProviderStream } from '@/application/use-cases/agents/chat-turn/stream-chat-turn'
import { ApiErrorCode } from '@/domain/models/api/error'
import { logError } from '@/infrastructure/logging/logger'
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
import { runEffectSse } from '@/presentation/api/runtime/effect-sse'
import { toErrorResponse, type HandlerAnswer } from '@/presentation/api/runtime/run-effect'
import type { ChatTurnStepError } from '@/application/use-cases/agents/chat-turn/run-chat-turn'
import type {
  ChatStreamOpenError,
  ChatTurnWire,
  StreamedTurn,
} from '@/application/use-cases/agents/chat-turn/stream-chat-turn'
import type { Context } from 'hono'

/**
 * Map a pre-flight failure to a non-200 JSON response. Mirrors the
 * non-streaming route's tagged-error → status mapping so the two surfaces
 * are predictable for the same provider failure modes.
 */
const mapPreflightError = (c: Context, err: ChatStreamOpenError): Response => {
  const tagged: { readonly _tag: string; readonly message?: string } = err
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
 * The turn as the wire carries it: interrupted by a stop, which then ends it
 * as `done { stopped }`, and each `done` followed by the `[DONE]` sentinel.
 */
const stoppableTurn =
  (stop: Deferred.Deferred<void>): ChatTurnWire['frame'] =>
  (events) =>
    Stream.concat(
      events.pipe(Stream.interruptWhen(Deferred.await(stop))),
      Stream.suspend(() =>
        Deferred.isDoneUnsafe(stop) ? Stream.succeed(stoppedDone) : Stream.empty
      )
    ).pipe(
      Stream.filter(reachesTheWire),
      Stream.flatMap((event) =>
        event.type === 'done'
          ? Stream.make<WireEvent[]>(event, { type: 'sentinel' })
          : Stream.succeed(event)
      )
    )

/** The turn a pause keeps, so the person's answer can go on with it. */
const heldTurn = (turn: StreamedTurn): HeldChatTurn => ({
  userId: turn.userId,
  sessionId: turn.sessionId,
  message: turn.message,
  agentName: turn.agentName,
  userParts: turn.userParts,
  spec: turn.spec,
  passages: turn.passages,
  parentId: turn.parentId,
})

/** Remember a turn paused on a call held for approval, or on a question to the person. */
const holdPausedTurn: ChatTurnWire['pause'] = (result, turn) =>
  Effect.suspend(() => {
    if (result.approvalId !== undefined) holdChatTurn(result.approvalId, heldTurn(turn))
    else if (result.elicitation !== undefined) {
      return holdChatElicitation({ ...heldTurn(turn), elicitation: result.elicitation })
    }
    return Effect.void
  })

/**
 * Run a streamed turn's program, inside the handler's own program, and answer
 * with its stream.
 *
 * `forward` is the turn's program, handed the wire it forwards through. Until
 * it opens its stream nothing is answered, so a stream that cannot be opened
 * is answered with its error status. Once open, the stream is the answer
 * (`handle.answer`) and its events are written as typed SSE events while the
 * program goes on; when the forwarding ends — completed, the client gone, the
 * lifetime spent — the program is told so, and the response is held open
 * until the handler's program ended (`handle.ended`), which saves the exchange
 * first: a read right after the stream must find it.
 */
export const respondWithTurnStream = <R>(
  c: Context,
  handle: HandlerAnswer,
  thread: { readonly userId: string; readonly sessionId: string },
  forward: (
    wire: ChatTurnWire
  ) => Effect.Effect<unknown, ChatStreamOpenError | ChatTurnStepError, R>
): Effect.Effect<Response, never, R> =>
  Effect.gen(function* () {
    // The stop signal, registered before anything runs so a pre-flight stop is not lost.
    const { stop, release } = registerStop(c, thread)
    const answered: { response?: Response } = {}
    const wire: ChatTurnWire = {
      frame: stoppableTurn(stop),
      pause: holdPausedTurn,
      open: (opened) =>
        Effect.gen(function* () {
          const meta = turnMeta(opened.turn)
          const events = Stream.concat(Stream.succeed(opened.head), opened.events)
          // Encoding renders the answer, which highlights its code asynchronously,
          // so it is mapped onto the stream as an Effect, one event at a time, in order.
          const response = runEffectSse(
            c,
            Stream.mapEffect(events, createTurnEncoder(meta)),
            (chunk) => chunk,
            {
              onTerminate: async (reason) => {
                release()
                opened.end(reason)
                await handle.ended
              },
            }
          )
          answered.response = response
          yield* handle.answer(response)
          return meta.ids
        }),
    }
    // A turn that did not get to open its stream is over, its stop signal too.
    const ran = yield* Effect.result(forward(wire)).pipe(Effect.onError(() => Effect.sync(release)))
    if (answered.response !== undefined) return answered.response
    release()
    // A program ends without opening its stream only by failing to open it.
    const failure = ran._tag === 'Failure' ? ran.failure : new EmptyProviderStream({})
    if (failure._tag === 'ChatTurnStepError') return toErrorResponse(c, failure.cause)
    logError('[ai] chat-stream pre-flight failed', failure)
    return mapPreflightError(c, failure)
  })
