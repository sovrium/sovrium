/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Streaming AI chat helpers — `POST /api/ai/chat/stream`.
 *
 * Drives `[internal ref]` ([internal ref] — Streaming
 * AI Responses). Split out of `ai-chat.ts` to keep that file under the
 * `max-lines` cap; the buffered `/api/ai/chat` route stays there.
 *
 * Responsibilities:
 *  - Encode `ChatChunk`s as OpenAI-compatible SSE `data:` event lines so
 *    clients that already parse OpenAI's streaming protocol work unchanged.
 *  - Pre-flight the provider stream with `Stream.peel` so config / provider
 *    errors AND the `AI_CHAT_STREAM_TIMEOUT` deadline can map to a non-200
 *    HTTP status (502/503/504) BEFORE `streamSSE` commits the response.
 *  - Forward chunks to the wire in real time via the `runEffectSse` bridge
 *, with the source-stream's `Scope` kept alive
 *    across pre-flight + drain via manual `Scope` management so the
 *    underlying provider connection is not torn down between phases.
 *  - Persist the assembled assistant message to durable conversation history
 * once the stream reaches its terminal chunk.
 *    `onTerminate` only persists when `reason === 'completed'` AND the
 * terminal `done` chunk was observed.
 *
 * Timeout semantics shift: prior to the SSE-bridge refactor,
 * `AI_CHAT_STREAM_TIMEOUT` deadlined the whole exchange (because the route
 * buffered the full provider stream before responding). Post-refactor it
 * deadlines TIME-TO-FIRST-CHUNK — a stricter contract that bounds the
 * pre-flight wait. STREAM-006 still asserts 504 on an empty provider;
 * STREAM-012 is the diagnostic that proves the semantic.
 */

import { Data, Duration, Effect, Exit, Option, Scope, Sink, Stream } from 'effect'
import { AiService, type ChatChunk } from '@/application/ports/services/ai-service'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain } from '@/infrastructure/logging/request-effect'
import { persistTurnDurably } from '@/presentation/api/ai/chat-durable-memory'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import {
  runEffectSse,
  type EncodedChunk,
  type SseTerminationReason,
} from '@/presentation/api/runtime/effect-sse'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/**
 * Encode a single ChatChunk as the bridge's `EncodedChunk`.
 *
 * `content` chunks are wrapped in a chat-completion `delta` envelope so
 * clients that already parse OpenAI's streaming protocol (e.g. Vercel AI
 * SDK, OpenAI's own SDK) work without translation. The terminal `done`
 * chunk becomes the bridge's `terminal` kind, which renders the canonical
 * `data: [DONE]` sentinel on the wire.
 */
export const encodeChatChunk = (chunk: ChatChunk): EncodedChunk => {
  if (chunk.type === 'done') {
    return { kind: 'terminal' }
  }
  return {
    kind: 'data',
    payload: {
      object: 'chat.completion.chunk',
      choices: [
        // OpenAI SSE protocol literally uses JSON null here for non-terminal
        // chunks; substituting undefined would omit the field and break
        // strict clients that switch on its presence.
        // eslint-disable-next-line unicorn/no-null -- protocol-mandated null value
        { index: 0, delta: { content: chunk.delta }, finish_reason: null },
      ],
    },
  }
}

/**
 * Resolve the operator-tunable streaming-chat timeout budget.
 *
 * `AI_CHAT_STREAM_TIMEOUT` is the ms budget for the PRE-FLIGHT phase — the
 * window during which the provider must land its first chunk. A breach
 * surfaces as HTTP 504. Unset / empty /
 * non-numeric → no deadline. Zero and negatives collapse to `undefined`
 * so "no timeout" reads uniformly with the unset case.
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

/** Inputs for one streamed chat turn dispatched to the AI provider. */
export interface StreamTurnInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly message: string
  readonly sessionId: string
  readonly userId: string
}

/**
 * Map a pre-flight failure to a non-200 JSON response. Mirrors the
 * non-streaming route's tagged-error → status mapping so the two surfaces
 * are predictable for the same provider failure modes.
 */
const mapPreflightError = (c: Readonly<Context>, err: unknown): Response => {
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
 *   1. Open the provider stream via `AiService.chatStream`.
 *   2. Peel the first chunk with `Stream.peel(Sink.head())`, optionally
 *      gated by `Effect.timeoutOrElse({ AI_CHAT_STREAM_TIMEOUT })`.
 *   3. Map any failure (config error, provider error, timeout, empty
 *      stream) to a non-200 JSON response.
 *
 * ## Why this one scope is NOT `Effect.scoped` (W4 exception, and it is real)
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
 * So the scope is created explicitly and handed off. What W4 DID remove is the
 * remembered part: three separate `Scope.close` call sites, one per pre-flight
 * exit, each of which was a leak if a later edit added a fourth exit above it.
 * The empty-stream case is now folded into the error channel and a single
 * `Effect.onExit` closes the scope on ANY pre-flight failure, so the only close
 * left is the deliberate hand-off in `onTerminate`.
 *
 * Making this a true `Effect.scoped` means teaching `runEffectSse` to own a
 * scope across the commit boundary — a change to the shared SSE bridge that all
 * four of its consumers would inherit, and a different piece of work.
 *
 * Phase 2 — drain (AFTER 200 is committed):
 *   4. Prepend the peeled head onto the rest stream so chunk-1 is on the
 *      wire as the first SSE event.
 *   5. `Stream.tap` accumulates the assembled assistant text and observes
 *      the terminal `done` chunk into closure-captured mutable state.
 *   6. The bridge's `onTerminate` callback persists ONLY when
 *      `reason === 'completed'` AND the terminal `done` chunk was observed
 * ([internal ref] contract).
 *   7. The externally-held `Scope` is closed by `onTerminate` for ALL
 *      termination reasons so the provider connection is released exactly
 *      once.
 */
export const buildStreamResponse = async (
  c: Readonly<Context>,
  input: StreamTurnInput
): Promise<Response> => {
  const timeoutMs = resolveStreamTimeoutMs()

  // Externally-managed scope. Stays open across runPromise calls so the
  // rest stream's underlying provider connection survives into the drain.
  const scope = await Effect.runPromise(Scope.make())

  // Pre-flight: open source + peel first chunk (with optional timeout).
  const peelEffect = Effect.gen(function* () {
    const ai = yield* AiService
    const source = ai.chatStream({ messages: [{ role: 'user', content: input.message }] })
    return yield* Stream.peel(source, Sink.head<ChatChunk>())
  })

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
    // An empty provider stream is a pre-flight FAILURE dressed as a success
    // with no head. Folding it into the error channel here is what lets the
    // single finalizer below cover it — and it reaches `mapPreflightError` by
    // the same route as every other pre-flight failure instead of by a second,
    // parallel one. Placed AFTER the timeout on purpose: `peel` has already
    // resolved, so this branch is not something the deadline should race.
    Effect.flatMap(([headOpt, rest]) =>
      Option.isNone(headOpt)
        ? Effect.fail(new EmptyProviderStream({}))
        : Effect.succeed([headOpt.value, rest] as const)
    ),
    // THE one place the scope's fate is decided. A failed pre-flight releases
    // the provider connection; a successful one hands it to the drain, which
    // closes it from `onTerminate`. Stating it once means a future edit that
    // adds another failure mode above cannot forget to release.
    Effect.onExit((exit) => (Exit.isSuccess(exit) ? Effect.void : Scope.close(scope, Exit.void)))
  )
  const result = await Effect.runPromise(Effect.result(preflight))

  if (result._tag === 'Failure') {
    logError('[ai] chat-stream pre-flight failed', result.failure)
    return mapPreflightError(c, result.failure)
  }

  const [head, rest] = result.success
  const accumulator = buildPersistAccumulator(head)
  const instrumented = Stream.tap(rest, accumulator.tap)
  const prepended = Stream.concat(Stream.succeed(head), instrumented)

  return runEffectSse(c, prepended, encodeChatChunk, {
    onTerminate: buildOnTerminate(scope, input, accumulator.snapshot),
  })
}

/**
 * Build the persistence accumulator + `Stream.tap` callback for the drain.
 *
 * `assembled` accumulates every `content` chunk's `delta` (seeded from the
 * peeled head so chunk-1 is not lost). `sawDone` flips on the terminal
 * `done` chunk. `snapshot()` reads the final state at termination time.
 */
const buildPersistAccumulator = (
  head: ChatChunk
): {
  readonly tap: (chunk: ChatChunk) => Effect.Effect<void>
  readonly snapshot: () => { readonly assembled: string; readonly sawDone: boolean }
} => {
  /* eslint-disable functional/no-let, functional/no-expression-statements -- closure-captured accumulators for the chat-history persist-on-success contract; mutation is the explicit purpose of this helper */
  let assembled = head.type === 'content' ? head.delta : ''
  let sawDone = head.type === 'done'
  return {
    tap: (chunk) =>
      Effect.sync(() => {
        if (chunk.type === 'content') {
          assembled += chunk.delta
        } else if (chunk.type === 'done') {
          sawDone = true
        }
      }),
    snapshot: () => ({ assembled, sawDone }),
  }
  /* eslint-enable functional/no-let, functional/no-expression-statements */
}

/**
 * Build the bridge's `onTerminate` handler. Closes the externally-held
 * `Scope` (releasing the provider connection) for every termination reason,
 * and persists the assembled message ONLY when the drain resolved cleanly
 * AND the terminal `done` chunk was observed.
 */
const buildOnTerminate = (
  // EFFECT 4: `Scope.CloseableScope` -> `Scope.Closeable` (migration:14612).
  scope: Scope.Closeable,
  input: StreamTurnInput,
  snapshot: () => { readonly assembled: string; readonly sawDone: boolean }
): ((reason: SseTerminationReason) => Promise<void>) => {
  return async (reason) => {
    // Close the externally-held scope ALWAYS so the provider connection
    // releases regardless of termination reason. Errors here are logged
    // but never block the persistence side-effect below.
    await Effect.runPromise(Scope.close(scope, Exit.void)).catch((err) => {
      logError('[chat-stream] scope close failed', err)
    })

    if (reason !== 'completed') return
    const { assembled, sawDone } = snapshot()
    if (!sawDone) return
    // Await persistence so the HTTP response stays "open" until the row is
    // committed — STREAM-008's read-after-write would otherwise race.
    await persistTurnDurably(input.services, {
      userId: input.userId,
      sessionId: input.sessionId,
      userMessage: input.message,
      assistantReply: assembled,
    }).catch((err) => {
      // Best-effort — log but never throw out of onTerminate.
      logError('[chat-stream] persistTurnDurably failed', err)
    })
  }
}
