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

import { Data, Duration, Effect, Stream } from 'effect'
import { getBunServer } from 'hono/bun'
import { streamSSE } from 'hono/streaming'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_STREAM_MAX_LIFETIME_MS,
} from '@/presentation/api/runtime/sse-stream'
import type { Context } from 'hono'
import type { SSEStreamingApi } from 'hono/streaming'

/**
 * Bun rejects an idle timeout above this many seconds (`ServerConfig.rs`
 * throws `expects idleTimeout to be 255 or less`).
 */
const BUN_MAX_IDLE_TIMEOUT_S = 255

/**
 * Slack between the stream's own lifetime ceiling and the socket's idle
 * timeout, so the ceiling is always what ends a healthy stream.
 */
const SOCKET_TIMEOUT_MARGIN_S = 5

/**
 * How long the SOCKET may sit idle, for a stream budgeted `lifetimeMs`.
 *
 * `0` means "no socket timeout" and is returned only when the stream's own
 * budget exceeds what Bun can express — past that point the stream's ceiling
 * is the only bound available.
 */
export const socketIdleTimeoutSecondsFor = (lifetimeMs: number): number => {
  const seconds = Math.ceil(lifetimeMs / 1000) + SOCKET_TIMEOUT_MARGIN_S
  return seconds > BUN_MAX_IDLE_TIMEOUT_S ? 0 : seconds
}

/** The one method of the Bun `Server` this module needs. */
interface TimeoutCapableServer {
  readonly timeout: (request: Request, seconds: number) => void
}

/**
 * Re-arm Bun's per-request idle timeout to outlast this stream.
 *
 * Bun arms a 10 s idle timeout on EVERY request — streaming ones included —
 * and a quiet SSE response is, to the socket layer, an idle one. With the
 * shipped cadence (15 s heartbeat, 25 s ceiling) that timeout always fired
 * FIRST: measured against `apps/website`, a dev-reload stream was severed
 * after ~12 s, the 15 s heartbeat never ticked once, the 25 s ceiling was
 * never reached, and `onTerminate` saw `aborted` where the design says
 * `timeout`. Bun also printed its once-per-process
 * `Bun.serve() timed out a request after 10 seconds` warning.
 *
 * Widening the SERVER-wide `idleTimeout` would fix the symptom by removing
 * the slow-request protection from every ordinary request too. This is the
 * per-request lever Bun documents for exactly this case, so streams opt out
 * and normal requests keep the default guard.
 *
 * Deliberately not `0`/"never": a stream that wedges past its own ceiling is
 * still reclaimed by the socket layer rather than held open forever.
 *
 * A no-op off the Bun adapter (unit tests drive this through `app.request()`,
 * where there is no server in `c.env`).
 */
const armSocketIdleTimeout = (c: Context, lifetimeMs: number): void => {
  // `getBunServer` reaches straight into `c.env` with an `in` check, which
  // throws on a non-object — and `app.request()` in the unit tests supplies
  // none. Guard before the call, not after.
  const { env } = c
  if (typeof env !== 'object' || env === null) return
  const server = getBunServer<Partial<TimeoutCapableServer>>(c)
  if (typeof server?.timeout !== 'function') return
  try {
    server.timeout(c.req.raw, socketIdleTimeoutSecondsFor(lifetimeMs))
  } catch (err) {
    // A request already detached from its socket (client vanished between
    // routing and here) throws rather than returning. Losing the re-arm is
    // survivable — the stream's own ceiling still bounds it — so this must
    // not take the response down with it.
    logError('[sse] could not re-arm socket idle timeout', err)
  }
}

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

/**
 * A write to the SSE wire failed.
 *
 * Almost always a client that went away mid-stream — a closed tab, a
 * navigation, a dropped connection — which is the ORDINARY end of an SSE
 * connection rather than a fault. It earns a type because the alternative was
 * `Effect.promise`, which declared the write infallible: `stream.writeSSE`
 * rejects on a closed socket, so the rejection became a DEFECT that flew
 * straight past the drain's own `Effect.catch` and was logged as a runtime
 * panic. The routine case was the one reported most alarmingly.
 */
export class SseWriteError extends Data.TaggedError('SseWriteError')<{
  readonly cause: unknown
}> {}

/**
 * Options that tune one `runEffectSse` invocation.
 *
 * Parameterised by the source's REQUIREMENTS only. It used to carry the error
 * channel too, but the only member that mentioned it was `provideLayer`, and
 * providing a layer discharges requirements — it has nothing to say about how a
 * program fails. Pinning `E` there forced the drain to be cast through
 * `as unknown as` on the way in and out.
 */
export interface RunEffectSseOptions<R> {
  /** Heartbeat cadence (ms). Default: `SSE_HEARTBEAT_INTERVAL_MS` (15s). */
  readonly heartbeatMs?: number
  /** Hard stream lifetime (ms). Default: `SSE_STREAM_MAX_LIFETIME_MS` (25s). */
  readonly lifetimeMs?: number
  /** Items emitted before draining the source (handshake / snapshot events). */
  readonly preamble?: ReadonlyArray<Record<string, unknown>>
  /**
   * SSE `retry:` field (ms), written alongside the FIRST preamble item — the
   * delay a browser waits before reconnecting once the stream drops.
   *
   * Deliberately has NO default. Left unset, a browser applies its own
   * fallback (3 s in Chrome), which is the right behaviour for the
   * subscribe / presence / chat streams: those reconnect after a real network
   * drop, and reconnecting every few hundred milliseconds would be worse than
   * waiting. Only the dev live-reload stream wants an aggressive value,
   * because there the reconnect IS the mechanism that carries the new server
   * generation to the page.
   */
  readonly retryMs?: number
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
  readonly provideLayer?: <T, Err>(fx: Effect.Effect<T, Err, R>) => Effect.Effect<T, Err, never>
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
  preamble: ReadonlyArray<Record<string, unknown>> | undefined,
  retryMs: number | undefined
): Promise<void> => {
  if (!preamble) return
  /* eslint-disable-next-line functional/no-loop-statements -- sequential async iteration; reduce-with-async would obscure intent */
  for (const [index, item] of preamble.entries()) {
    // `retry:` is a connection-level directive, not per-event: the browser
    // remembers the last value it saw. Writing it once, on the very first
    // frame, is therefore enough — and Hono omits the field entirely when
    // `retry` is absent, so streams that pass no `retryMs` are byte-identical
    // to what they emitted before.
    await stream.writeSSE({
      data: JSON.stringify(item),
      ...(index === 0 && retryMs !== undefined ? { retry: retryMs } : {}),
    })
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
  /** The source failed mid-stream: a real fault, logged at error level. */
  | { readonly tag: 'failed'; readonly error: unknown }
  /** The wire write failed: the client went away. Routine, logged at debug. */
  | { readonly tag: 'disconnected'; readonly cause: unknown }

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
  readonly provideLayer: RunEffectSseOptions<R>['provideLayer']
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

  const writeChunk = (chunk: A): Effect.Effect<void, SseWriteError> => {
    const data = renderChunk(chunk)
    return Effect.tryPromise({
      try: () => stream.writeSSE({ data }),
      catch: (cause) => new SseWriteError({ cause }),
    })
  }

  const drainArm: Effect.Effect<DrainOutcome, never, R> = Stream.runForEach(
    source,
    writeChunk
  ).pipe(
    Effect.as<DrainOutcome>({ tag: 'completed' }),
    // A wire-write failure and a SOURCE failure are different events and are
    // reported differently — see `DrainOutcome`. Both still end the drain.
    Effect.catch((error) =>
      Effect.succeed<DrainOutcome>(
        error instanceof SseWriteError
          ? { tag: 'disconnected', cause: error.cause }
          : { tag: 'failed', error }
      )
    )
  )

  // The PROVIDED branch needs no cast any more. `provideLayer` is generic in the
  // success type, so `Effect.provide` returns the narrowed channel directly; the
  // double `as unknown as` that used to stand here claimed BOTH that the drain
  // produced `void` and that its requirements were discharged, and the rule
  // could see neither half through the `unknown` hop.
  //
  // The OMITTED branch keeps one assertion, and it is not removable by typing.
  // Omitting `provideLayer` is the caller ASSERTING that its source needs no
  // services — a fact about a value TypeScript cannot recover from the absence
  // of a property. Encoding it would mean overloading `runEffectSse` on
  // `R extends never`, which changes a public signature with four call sites to
  // move the same assertion one level up. Narrow, single, and stated:
  const alreadyDischarged =
    // @effect-diagnostics-next-line unsafeEffectTypeAssertion:off -- `provideLayer` omitted IS the caller's claim that `R` is `never`; see the paragraph above for why the type system cannot check it here.
    drainArm as Effect.Effect<DrainOutcome, never, never>
  const provided: Effect.Effect<DrainOutcome, never, never> = provideLayer
    ? provideLayer(drainArm)
    : alreadyDischarged

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
 *   0. Re-arm the socket's idle timeout past `lifetimeMs`, so Bun's 10 s
 *      default does not sever the stream before step 4 can end it.
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
  options: RunEffectSseOptions<R> = {}
): Response => {
  const heartbeatMs = options.heartbeatMs ?? SSE_HEARTBEAT_INTERVAL_MS
  const lifetimeMs = options.lifetimeMs ?? SSE_STREAM_MAX_LIFETIME_MS

  // Before `streamSSE` commits the 200: the socket must be allowed to outlive
  // the stream's own ceiling, or Bun's 10 s idle timeout ends it first.
  armSocketIdleTimeout(c, lifetimeMs)

  return streamSSE(c, async (stream) => {
    const terminate = createTerminationLatch(options.onTerminate)
    // `stream.onAbort` is a sync callback — we can't await terminate here.
    // Fire-and-forget; the latch ensures terminate runs once and any
    // termination-handler exception is logged inside the latch.
    stream.onAbort(() => {
      void terminate('aborted')
    })

    await emitPreamble(stream, options.preamble, options.retryMs)
    const stopHeartbeat = startHeartbeat(stream, heartbeatMs, options.onHeartbeat)

    try {
      const outcome = await drainSource({
        stream,
        source,
        encode,
        lifetimeMs,
        provideLayer: options.provideLayer,
      })
      if (outcome.tag === 'disconnected') {
        // The client closed the connection mid-stream. This is how most SSE
        // connections end, so it is NOT an error: debug level, and the same
        // 'aborted' termination `stream.onAbort` would have fired.
        logDebug('[sse] client disconnected mid-stream', { cause: String(outcome.cause) })
        await terminate('aborted')
      } else if (outcome.tag === 'failed') {
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
