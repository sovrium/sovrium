/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Duration, Effect, Exit, Option, Scope, Sink, Stream } from 'effect'
import { AiService, type ChatChunk } from '@/application/ports/services/ai-service'
import { persistTurnDurably } from '@/presentation/api/routes/ai/chat-durable-memory'
import { provideAiLive } from '@/presentation/api/routes/ai/effect-runner'
import {
  runEffectSse,
  type EncodedChunk,
  type SseTerminationReason,
} from '@/presentation/api/utils/effect-sse'
import type { Context } from 'hono'

export const encodeChatChunk = (chunk: ChatChunk): EncodedChunk => {
  if (chunk.type === 'done') {
    return { kind: 'terminal' }
  }
  return {
    kind: 'data',
    payload: {
      object: 'chat.completion.chunk',
      choices: [
        { index: 0, delta: { content: chunk.delta }, finish_reason: null },
      ],
    },
  }
}

const resolveStreamTimeoutMs = (
  env: Readonly<Record<string, string | undefined>> = process.env
): number | undefined => {
  const raw = env.AI_CHAT_STREAM_TIMEOUT
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

class StreamTimeout extends Data.TaggedError('StreamTimeout')<{
  readonly timeoutMs: number
}> {}

class EmptyProviderStream extends Data.TaggedError('EmptyProviderStream')<Record<string, never>> {}

export interface StreamTurnInput {
  readonly message: string
  readonly sessionId: string
  readonly userId: string
}

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

export const buildStreamResponse = async (
  c: Readonly<Context>,
  input: StreamTurnInput
): Promise<Response> => {
  const timeoutMs = resolveStreamTimeoutMs()

  const scope = await Effect.runPromise(Scope.make())

  const peelEffect = Effect.gen(function* () {
    const ai = yield* AiService
    const source = ai.chatStream({ messages: [{ role: 'user', content: input.message }] })
    return yield* Stream.peel(source, Sink.head<ChatChunk>())
  })

  const withScope = Scope.extend(peelEffect, scope)
  const provided = provideAiLive(withScope)
  const withTimeout =
    timeoutMs === undefined
      ? provided
      : provided.pipe(
          Effect.timeoutFail({
            duration: Duration.millis(timeoutMs),
            onTimeout: () => new StreamTimeout({ timeoutMs }),
          })
        )
  const result = await Effect.runPromise(Effect.either(withTimeout))

  if (result._tag === 'Left') {
    await Effect.runPromise(Scope.close(scope, Exit.void))
    return mapPreflightError(c, result.left)
  }

  const [headOpt, rest] = result.right
  if (Option.isNone(headOpt)) {
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

const buildPersistAccumulator = (
  head: ChatChunk
): {
  readonly tap: (chunk: ChatChunk) => Effect.Effect<void>
  readonly snapshot: () => { readonly assembled: string; readonly sawDone: boolean }
} => {
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
}

const buildOnTerminate = (
  scope: Scope.CloseableScope,
  input: StreamTurnInput,
  snapshot: () => { readonly assembled: string; readonly sawDone: boolean }
): ((reason: SseTerminationReason) => Promise<void>) => {
  return async (reason) => {
    await Effect.runPromise(Scope.close(scope, Exit.void)).catch((err) => {
      console.error('[chat-stream] scope close failed', err)
    })

    if (reason !== 'completed') return
    const { assembled, sawDone } = snapshot()
    if (!sawDone) return
    await persistTurnDurably(input.userId, input.sessionId, input.message, assembled).catch(
      (err) => {
        console.error('[chat-stream] persistTurnDurably failed', err)
      }
    )
  }
}
