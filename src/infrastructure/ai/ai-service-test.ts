/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- AiError tagged classes are mutable by Data.TaggedError design */

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

/**
 * AiService test Layer factory.
 *
 * Provides a `Layer.succeed`-based stub for unit-testing use cases that
 * depend on `AiService` without going through `AiServiceLive` (which would
 * read `process.env` and call out via `fetch`).
 *
 * Per project memory `feedback_mock_module_contamination`, application-
 * layer unit tests must NOT use `mock.module()` — pass mocks as parameters
 * instead. This factory is the canonical pattern for that DI.
 *
 * @example
 *   const Live = makeAiServiceTest({ canned: { content: 'Hello!', model: 'm' } })
 *   const result = await Effect.runPromise(
 *     program.pipe(Effect.provide(Live))
 *   )
 */
export interface AiServiceTestOptions {
  /** Static reply returned by every `chat` call. */
  readonly canned?: ChatReply
  /**
   * Optional response provider for prompt-pattern-based stubbing.
   * When provided, takes precedence over `canned`.
   */
  readonly respond?: (input: ChatInput) => ChatReply | AiError
  /**
   * Static chunk sequence emitted by every `chatStream` call. The factory
   * automatically appends a terminal `{ type: 'done', model }` chunk when
   * the array contains only `content` deltas, so test fixtures can supply
   * just the deltas they care about.
   */
  readonly streamCanned?: ReadonlyArray<ChatChunk>
  /**
   * Optional stream-response provider for prompt-pattern-based stubbing.
   * Mirrors `respond` for streams; takes precedence over `streamCanned`.
   */
  readonly streamRespond?: (input: ChatInput) => ReadonlyArray<ChatChunk> | AiError
  /** Override the return value of `isConfigured()`. Default: true. */
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

/**
 * Canonical DI test Layer for `AiService` (see the module-level docs above).
 *
 * @public — consumed by unit tests across layers, not from `src/index.ts`.
 */
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
      isConfigured: () => options.isConfigured ?? true,
    })
  )
