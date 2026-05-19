/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Duration, Effect, Stream } from 'effect'
import { AiService, type ChatChunk } from '@/application/ports/services/ai-service'
import { persistTurnDurably } from '@/presentation/api/routes/ai/chat-durable-memory'
import { provideAiLive } from '@/presentation/api/routes/ai/effect-runner'
import type { Context } from 'hono'

export const encodeSseEvent = (chunk: ChatChunk): string => {
  if (chunk.type === 'done') {
    return 'data: [DONE]\n\n'
  }
  const payload = {
    object: 'chat.completion.chunk',
    choices: [
      { index: 0, delta: { content: chunk.delta }, finish_reason: null },
    ],
  }
  return `data: ${JSON.stringify(payload)}\n\n`
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

export interface StreamTurnInput {
  readonly message: string
  readonly sessionId: string
  readonly userId: string
}

const collectStreamChunks = (message: string) => {
  const timeoutMs = resolveStreamTimeoutMs()
  const collect = Effect.gen(function* () {
    const ai = yield* AiService
    return yield* Stream.runCollect(
      ai.chatStream({ messages: [{ role: 'user', content: message }] })
    )
  })
  const program =
    timeoutMs === undefined
      ? collect
      : collect.pipe(
          Effect.timeoutFail({
            duration: Duration.millis(timeoutMs),
            onTimeout: () => new StreamTimeout({ timeoutMs }),
          })
        )
  return Effect.runPromise(program.pipe(provideAiLive, Effect.either))
}

const sseResponse = (chunks: ReadonlyArray<ChatChunk>): Response => {
  const encoder = new TextEncoder()
  const encodedChunks = chunks.map((chunk) => encoder.encode(encodeSseEvent(chunk)))
  const trailing = chunks.every((ch) => ch.type !== 'done')
    ? [encoder.encode('data: [DONE]\n\n')]
    : []
  const allEncoded = [...encodedChunks, ...trailing]
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      allEncoded.forEach((bytes) => controller.enqueue(bytes))
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const buildStreamResponse = async (
  c: Readonly<Context>,
  input: StreamTurnInput
): Promise<Response> => {
  const result = await collectStreamChunks(input.message)

  if (result._tag === 'Left') {
    const err = result.left
    if (err._tag === 'StreamTimeout') {
      return c.json({ error: 'The AI service timed out. Please try again.' }, 504)
    }
    if (err._tag === 'AiConfigError') {
      return c.json({ error: err.message }, 503)
    }
    return c.json({ error: err.message }, 502)
  }

  const chunks = Array.from(result.right)
  const assembled = chunks
    .filter((ch): ch is Extract<ChatChunk, { type: 'content' }> => ch.type === 'content')
    .map((ch) => ch.delta)
    .join('')
  await persistTurnDurably(input.userId, input.sessionId, input.message, assembled)
  return sseResponse(chunks)
}
