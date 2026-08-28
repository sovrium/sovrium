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
import { logError } from '@/infrastructure/logging/logger'
import { persistTurnDurably } from '@/presentation/api/routes/ai/chat-durable-memory'
import { provideAiLive } from '@/presentation/api/routes/ai/effect-runner'
import {
  runEffectSse,
  type EncodedChunk,
  type SseTerminationReason,
} from '@/presentation/api/utils/effect-sse'
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
    return c.json({ error: 'The AI service timed out. Please try again.' }, 504)
  }
  if (tagged._tag === 'AiConfigError') {
    return c.json({ error: tagged.message ?? 'AI service not configured' }, 503)
  }
  if (tagged._tag === 'EmptyProviderStream') {
    return c.json({ error: 'AI service returned an empty stream' }, 502)
  }
  return c.json({ error: tagged.message ?? 'AI provider error' }, 502)
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
 * The provider stream's `Scope` is managed manually via `Scope.make()` +
 * `Scope.extend` + `Scope.close` rather than `Effect.scoped` — because
 * the rest stream lives PAST the pre-flight phase and into the drain, and
 * `Effect.scoped` would close the scope (and tear down the in-flight HTTP
 * connection) the moment `Effect.runPromise` resolves.
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
  const provided = provideAiLive(withScope)
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
  const result = await Effect.runPromise(Effect.result(withTimeout))

  if (result._tag === 'Failure') {
    logError('[ai] chat-stream pre-flight failed', result.failure)
    // Pre-flight failed — release the scope and return the mapped status.
    // eslint-disable-next-line functional/no-expression-statements -- void Promise<void> await; the `ignoreVoid` rule option misses awaited runPromise here
    await Effect.runPromise(Scope.close(scope, Exit.void))
    return mapPreflightError(c, result.failure)
  }

  const [headOpt, rest] = result.success
  if (Option.isNone(headOpt)) {
    // eslint-disable-next-line functional/no-expression-statements -- void Promise<void> await; same as above
    await Effect.runPromise(Scope.close(scope, Exit.void))
    return mapPreflightError(c, new EmptyProviderStream({}))
  }

  const head = headOpt.value
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
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget background logging (promise result intentionally discarded)
    await Effect.runPromise(Scope.close(scope, Exit.void)).catch((err) => {
      logError('[chat-stream] scope close failed', err)
    })

    if (reason !== 'completed') return
    const { assembled, sawDone } = snapshot()
    if (!sawDone) return
    // Await persistence so the HTTP response stays "open" until the row is
    // committed — STREAM-008's read-after-write would otherwise race.
    // eslint-disable-next-line functional/no-expression-statements -- fire-and-forget background logging (promise result intentionally discarded)
    await persistTurnDurably(input.userId, input.sessionId, input.message, assembled).catch(
      (err) => {
        // Best-effort — log but never throw out of onTerminate.
        logError('[chat-stream] persistTurnDurably failed', err)
      }
    )
  }
}
