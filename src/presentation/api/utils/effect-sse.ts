/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements --
 * This module bridges Effect.Stream onto Hono's SSE stream, which is an
 * inherently imperative pipeline: `setInterval`/`setTimeout` ticks, a
 * single-shot termination latch, `stream.onAbort` callback registration,
 * and `await stream.writeSSE(...)` per chunk. Every line in the lifecycle
 * is a side-effect on the wire. Forcing `ignoreVoid`-compatible wrappers
 * around each call would obscure the lifecycle ordering, which is the
 * thing we most need readers to see.
 */

/**
 * Effect.Stream → Hono SSE bridge — the single source of truth for the
 * realtime endpoints' lifecycle (preamble → drain → heartbeat → lifetime
 * ceiling). Three call sites — the table-change subscription endpoint, the
 * presence-awareness endpoint, and the AI chat-stream endpoint — used to
 * hand-roll this lifecycle independently and drifted apart on subtle details
 * (heartbeat ordering, abort observability, terminal-sentinel rendering).
 * This module consolidates them.
 *
 * Pre-flight vs mid-stream errors:
 *  - `streamSSE` commits HTTP 200 the moment its callback awaits anything,
 *    so any error mapping to a non-200 status (502/503/504) MUST happen
 *    BEFORE the source is passed to `runEffectSse`. The canonical pattern
 *    is `Stream.peel(1)` ahead of the bridge call — see
 *    `routes/ai/chat-stream.ts` for an example.
 *  - A failure during `Stream.runForEach` (the drain step) is a mid-stream
 *    error. The 200 is already on the wire, so we cannot change status;
 *    instead the bridge logs and fires `onTerminate('aborted')`. Callers
 *    relying on success-only side effects (e.g. persisting chat history)
 *    must guard on `reason === 'completed'`.
 */

import { Duration, Effect, Stream } from 'effect'
import { streamSSE } from 'hono/streaming'
import { logError } from '@/infrastructure/logging/logger'
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_STREAM_MAX_LIFETIME_MS,
} from '@/presentation/api/utils/sse-stream'
import type { Context } from 'hono'
import type { SSEStreamingApi } from 'hono/streaming'

/**
 * One chunk as it appears on the SSE wire.
 *
 * - `data`: a JSON-serialisable object rendered as `data: <json>\n\n`.
 * - `terminal`: the literal `data: [DONE]\n\n` sentinel from OpenAI's
 *   streaming protocol. Only the AI chat-stream uses `terminal`; the
 *   subscribe/presence streams never emit it.
 */
export type EncodedChunk =
  | { readonly kind: 'data'; readonly payload: Record<string, unknown> }
  | { readonly kind: 'terminal' }

/** Why the SSE stream stopped streaming. Exactly one fires per connection. */
export type SseTerminationReason = 'completed' | 'aborted' | 'timeout'

/** Options that tune one `runEffectSse` invocation. */
export interface RunEffectSseOptions<E, R> {
  /** Heartbeat cadence (ms). Default: `SSE_HEARTBEAT_INTERVAL_MS` (15s). */
  readonly heartbeatMs?: number
  /** Hard stream lifetime (ms). Default: `SSE_STREAM_MAX_LIFETIME_MS` (25s). */
  readonly lifetimeMs?: number
  /** Items emitted before draining the source (handshake / snapshot events). */
  readonly preamble?: ReadonlyArray<Record<string, unknown>>
  /** Ride-along callback fired on every heartbeat tick (e.g. presence touch). */
  readonly onHeartbeat?: () => void
  /**
   * Final-state observer. Fires exactly once per connection. May return
   * `void` (fire-and-forget) OR a `Promise<void>` (the bridge awaits the
   * promise before the streamSSE callback resolves, so the caller's HTTP
   * response is held open until the side effect completes — required for
   * chat-history persistence and other completion-tied work that must be
   * visible before the response is "done" from the client's perspective).
   */
  readonly onTerminate?: (reason: SseTerminationReason) => void | Promise<void>
  /**
   * Discharge the source's `R` (required-context). Required when the source
   * is layer-bound (e.g. `AiService`); omitted when the source already has
   * `R = never`.
   */
  readonly provideLayer?: (fx: Effect.Effect<void, E, R>) => Effect.Effect<void, E, never>
}

/**
 * Create the single-shot termination latch — first reason wins. Returned
 * `terminate` is idempotent and never throws on observer error.
 */
const createTerminationLatch = (
  onTerminate: ((reason: SseTerminationReason) => void | Promise<void>) | undefined
): ((reason: SseTerminationReason) => Promise<void>) => {
  // eslint-disable-next-line functional/no-let -- single-shot latch is inherently mutable
  let terminated = false
  return async (reason) => {
    if (terminated) return
    terminated = true
    try {
      await onTerminate?.(reason)
    } catch (err) {
      logError('[sse] onTerminate threw — swallowed', err)
    }
  }
}

/**
 * Emit preamble items sequentially. Ordering matters: the first event a
 * client sees on the wire is the first item in the preamble array.
 */
const emitPreamble = async (
  stream: SSEStreamingApi,
  preamble: ReadonlyArray<Record<string, unknown>> | undefined
): Promise<void> => {
  if (!preamble) return
  /* eslint-disable-next-line functional/no-loop-statements -- sequential async iteration; reduce-with-async would obscure intent */
  for (const item of preamble) {
    await stream.writeSSE({ data: JSON.stringify(item) })
  }
}

/**
 * Start the heartbeat ticker. Returns a function that clears it. The ticker
 * is NOT merged into the source stream because chat sources pause between
 * provider tokens, and a merged liveness stream would couple the ticker's
 * scheduler to a pause-prone source.
 */
const startHeartbeat = (
  stream: SSEStreamingApi,
  intervalMs: number,
  onHeartbeat: (() => void) | undefined
): (() => void) => {
  const timer = setInterval(() => {
    void (async () => {
      try {
        onHeartbeat?.()
        await stream.writeSSE({
          data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
        })
      } catch {
        /* connection closed mid-heartbeat — lifetime / abort handles teardown */
      }
    })()
  }, intervalMs)
  return () => clearInterval(timer)
}

/**
 * Drain outcome surfaced to the caller. The mid-stream `failed` variant
 * carries the captured error so the caller can log it.
 */
type DrainOutcome =
  | { readonly tag: 'completed' }
  | { readonly tag: 'timeout' }
  | { readonly tag: 'failed'; readonly error: unknown }

/**
 * Drain the source onto the SSE wire, racing against the lifetime ceiling.
 *
 * Each arm is converted into a *successful* `DrainOutcome` value (via
 * `Effect.catchAll` for failures) so `Effect.race` actually picks the first
 * arm to *finish*, not just the first to succeed. Without that conversion,
 * a drain failure would let the race wait for the lifetime arm and the
 * timeout would silently win.
 *
 * The race is structured inside the Effect runtime so the loser is
 * interrupted properly — without this, a never-completing source (e.g.
 * `Stream.never` in subscribe/presence) would leak `Stream.runForEach`
 * after the lifetime fires, blocking the `streamSSE` callback from
 * returning and stranding the HTTP response.
 */
interface DrainParams<A, E, R> {
  readonly stream: SSEStreamingApi
  readonly source: Stream.Stream<A, E, R>
  readonly encode: (chunk: A) => EncodedChunk
  readonly lifetimeMs: number
  readonly provideLayer: RunEffectSseOptions<E, R>['provideLayer']
}

const drainSource = <A, E, R>({
  stream,
  source,
  encode,
  lifetimeMs,
  provideLayer,
}: DrainParams<A, E, R>): Promise<DrainOutcome> => {
  // Serialize the payload OUTSIDE the Effect body so the only operation
  // inside `Effect.promise` is the wire-write I/O. Keeping `JSON.stringify`
  // out of the Effect context also sidesteps the `preferSchemaOverJson`
  // suggestion: this is a safe write-only serialization of a typed payload
  // (`Record<string, unknown>`) for the SSE wire format — there is no input
  // to parse and no Schema would add safety here. Encode is pure.
  const renderChunk = (chunk: A): string => {
    const encoded = encode(chunk)
    return encoded.kind === 'terminal' ? '[DONE]' : JSON.stringify(encoded.payload)
  }

  const writeChunk = (chunk: A) => {
    const data = renderChunk(chunk)
    return Effect.promise(() => stream.writeSSE({ data }))
  }

  const drainArm: Effect.Effect<DrainOutcome, never, R> = Stream.runForEach(
    source,
    writeChunk
  ).pipe(
    Effect.as<DrainOutcome>({ tag: 'completed' }),
    Effect.catchAll((error) => Effect.succeed<DrainOutcome>({ tag: 'failed', error }))
  )

  const provided: Effect.Effect<DrainOutcome, never, never> = provideLayer
    ? (provideLayer(drainArm as unknown as Effect.Effect<void, E, R>) as unknown as Effect.Effect<
        DrainOutcome,
        never,
        never
      >)
    : (drainArm as unknown as Effect.Effect<DrainOutcome, never, never>)

  const lifetimeArm: Effect.Effect<DrainOutcome, never, never> = Effect.sleep(
    Duration.millis(lifetimeMs)
  ).pipe(Effect.as<DrainOutcome>({ tag: 'timeout' }))

  return Effect.runPromise(Effect.race(provided, lifetimeArm))
}

/**
 * Bridge an `Effect.Stream<A, E, R>` onto a Hono SSE response.
 *
 * Lifecycle (single source of truth across all SSE endpoints):
 *
 *   1. Emit `preamble` items as `data:` events.
 *   2. Start a heartbeat ticker (`heartbeatMs`).
 *   3. Drain the source with `Stream.runForEach`.
 *   4. Cap the connection at `lifetimeMs` so `fetch`/Playwright callers see
 *      a clean EOF and browser `EventSource` clients auto-reconnect.
 *   5. Fire `onTerminate` exactly once, with the first reason that wins:
 *      - `completed` — drain resolved cleanly.
 *      - `timeout`   — lifetime ceiling hit first.
 *      - `aborted`   — client disconnected OR mid-stream error in source.
 */
export const runEffectSse = <A, E, R>(
  c: Context,
  source: Stream.Stream<A, E, R>,
  encode: (chunk: A) => EncodedChunk,
  options: RunEffectSseOptions<E, R> = {}
): Response => {
  const heartbeatMs = options.heartbeatMs ?? SSE_HEARTBEAT_INTERVAL_MS
  const lifetimeMs = options.lifetimeMs ?? SSE_STREAM_MAX_LIFETIME_MS

  return streamSSE(c, async (stream) => {
    const terminate = createTerminationLatch(options.onTerminate)
    // `stream.onAbort` is a sync callback — we can't await terminate here.
    // Fire-and-forget; the latch ensures terminate runs once and any
    // termination-handler exception is logged inside the latch.
    stream.onAbort(() => {
      void terminate('aborted')
    })

    await emitPreamble(stream, options.preamble)
    const stopHeartbeat = startHeartbeat(stream, heartbeatMs, options.onHeartbeat)

    try {
      const outcome = await drainSource({
        stream,
        source,
        encode,
        lifetimeMs,
        provideLayer: options.provideLayer,
      })
      if (outcome.tag === 'failed') {
        // Mid-stream failure — 200 was already committed by streamSSE, so we
        // cannot map this to a non-200 status. Log for observability and treat
        // it as an aborted connection (callers guarding on `completed` will
        // correctly skip success-only side effects like history persistence).
        logError('[sse] mid-stream error', outcome.error)
        await terminate('aborted')
      } else {
        // Awaiting terminate holds the streamSSE callback open until the
        // caller's onTerminate side-effects (e.g. persistTurnDurably) are
        // visible to the next request — without this, the HTTP response
        // resolves before chat-history persistence completes and STREAM-008
        // (read-after-write) races.
        await terminate(outcome.tag)
      }
    } catch (err) {
      // Defect: a fiber interruption or runtime panic landed as a rejection.
      // Same observability story as a `failed` outcome.
      logError('[sse] mid-stream defect', err)
      await terminate('aborted')
    } finally {
      stopHeartbeat()
    }
  })
}
