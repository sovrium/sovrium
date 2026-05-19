/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer, Stream } from 'effect'
import {
  AiService,
  AiProviderError,
  AiConfigError,
  type ChatInput,
  type ChatReply,
  type ChatChunk,
  type AiError,
} from '@/application/ports/services/ai-service'

export interface AiServiceTestOptions {
  readonly canned?: ChatReply
  readonly respond?: (input: ChatInput) => ChatReply | AiError
  readonly streamCanned?: ReadonlyArray<ChatChunk>
  readonly streamRespond?: (input: ChatInput) => ReadonlyArray<ChatChunk> | AiError
  readonly isConfigured?: boolean
}

const DEFAULT_CANNED: ChatReply = {
  content: 'OK',
  model: 'mock-model',
}

const isAiError = (value: ChatReply | AiError | ReadonlyArray<ChatChunk>): value is AiError =>
  value instanceof AiProviderError || value instanceof AiConfigError

const DEFAULT_STREAM_CHUNKS: ReadonlyArray<ChatChunk> = [
  { type: 'content', delta: 'OK' },
  { type: 'done', model: 'mock-model' },
]

const normaliseStreamChunks = (chunks: ReadonlyArray<ChatChunk>): ReadonlyArray<ChatChunk> => {
  const hasDone = chunks.some((c) => c.type === 'done')
  if (hasDone) return chunks
  return [...chunks, { type: 'done', model: 'mock-model' }]
}

export const makeAiServiceTest = (options: AiServiceTestOptions = {}): Layer.Layer<AiService> =>
  Layer.succeed(
    AiService,
    AiService.of({
      chat: (input: ChatInput): Effect.Effect<ChatReply, AiError> => {
        if (options.respond) {
          const result = options.respond(input)
          if (isAiError(result)) return Effect.fail(result)
          return Effect.succeed(result)
        }
        return Effect.succeed(options.canned ?? DEFAULT_CANNED)
      },
      chatStream: (input: ChatInput): Stream.Stream<ChatChunk, AiError> => {
        if (options.streamRespond) {
          const result = options.streamRespond(input)
          if (isAiError(result)) return Stream.fail(result)
          return Stream.fromIterable(normaliseStreamChunks(result))
        }
        return Stream.fromIterable(
          options.streamCanned !== undefined
            ? normaliseStreamChunks(options.streamCanned)
            : DEFAULT_STREAM_CHUNKS
        )
      },
      embed: () => Effect.succeed({ embedding: [0.1, 0.2, 0.3], model: 'mock-embedding' }),
      embeddingModel: () => 'mock-embedding',
      isConfigured: () => options.isConfigured ?? true,
    })
  )
