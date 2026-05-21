/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { Duration, Effect, Stream } from 'effect'
import { streamSSE } from 'hono/streaming'
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  SSE_STREAM_MAX_LIFETIME_MS,
} from '@/presentation/api/utils/sse-stream'
import type { Context } from 'hono'
import type { SSEStreamingApi } from 'hono/streaming'

export type EncodedChunk =
  | { readonly kind: 'data'; readonly payload: Record<string, unknown> }
  | { readonly kind: 'terminal' }

export type SseTerminationReason = 'completed' | 'aborted' | 'timeout'

export interface RunEffectSseOptions<E, R> {
  readonly heartbeatMs?: number
  readonly lifetimeMs?: number
  readonly preamble?: ReadonlyArray<Record<string, unknown>>
  readonly onHeartbeat?: () => void
  readonly onTerminate?: (reason: SseTerminationReason) => void | Promise<void>
  readonly provideLayer?: (fx: Effect.Effect<void, E, R>) => Effect.Effect<void, E, never>
}

const createTerminationLatch = (
  onTerminate: ((reason: SseTerminationReason) => void | Promise<void>) | undefined
): ((reason: SseTerminationReason) => Promise<void>) => {
  let terminated = false
  return async (reason) => {
    if (terminated) return
    terminated = true
    try {
      await onTerminate?.(reason)
    } catch (err) {
      console.error('[sse] onTerminate threw — swallowed', err)
    }
  }
}

const emitPreamble = async (
  stream: SSEStreamingApi,
  preamble: ReadonlyArray<Record<string, unknown>> | undefined
): Promise<void> => {
  if (!preamble) return
  for (const item of preamble) {
    await stream.writeSSE({ data: JSON.stringify(item) })
  }
}

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
      }
    })()
  }, intervalMs)
  return () => clearInterval(timer)
}

type DrainOutcome =
  | { readonly tag: 'completed' }
  | { readonly tag: 'timeout' }
  | { readonly tag: 'failed'; readonly error: unknown }

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
        console.error('[sse] mid-stream error', outcome.error)
        await terminate('aborted')
      } else {
        await terminate(outcome.tag)
      }
    } catch (err) {
      console.error('[sse] mid-stream defect', err)
      await terminate('aborted')
    } finally {
      stopHeartbeat()
    }
  })
}
