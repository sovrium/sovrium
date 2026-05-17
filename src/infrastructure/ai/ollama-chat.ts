/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- AiProviderError tagged class is mutable by Data.TaggedError design */

import { Effect, Stream } from 'effect'
import { AiProviderError } from '@/application/ports/services/ai-service'
import type {
  AiError,
  ChatChunk,
  ChatInput,
  ChatReply,
} from '@/application/ports/services/ai-service'

/**
 * Ollama-native chat path for the eco-conception provider router.
 *
 * When `ECO_AI_PROVIDER_PRECEDENCE` routes an AI call to the local Ollama
 * provider, the request must go to Ollama's native `POST /api/chat` endpoint
 * (not the OpenAI-compatible `/chat/completions` shape the cloud providers
 * use). Ollama's request/response wire format differs:
 *   - request: `{ model, messages, stream, options: { temperature } }`
 *   - response: `{ model, message: { role, content }, done, ... }`
 * Streaming Ollama responses are NDJSON (one JSON object per line); rather
 * than re-implement that parser here, the streaming variant issues a
 * non-streaming request and emits the full reply as a single chunk — adequate
 * for the eco-routing specs and for `ai:*` automation steps (which only use
 * the non-streaming `chat`).
 */

/** Resolved Ollama connection: base URL, default model, and optional bearer
 * (Ollama ignores auth, but the E2E mock uses it for per-test isolation). */
export interface OllamaConn {
  readonly baseUrl: string
  readonly defaultModel: string
  /** `AI_API_KEY`, when set — forwarded as `Authorization: Bearer …`. */
  readonly apiKey: string | undefined
  /** Default temperature from `AI_TEMPERATURE` (undefined when unset). */
  readonly temperature: number | undefined
}

interface OllamaChatPayload {
  readonly model?: string
  readonly message?: { readonly content?: string | null }
}

const DEFAULT_OLLAMA_TEMPERATURE = 0.7

const ollamaUrl = (baseUrl: string): string => `${baseUrl.replace(/\/+$/, '')}/api/chat`

const ollamaHeaders = (apiKey: string | undefined): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
})

const ollamaBody = (
  conn: OllamaConn,
  input: ChatInput,
  stream: boolean
): Record<string, unknown> => ({
  model: input.model ?? conn.defaultModel,
  messages: input.messages,
  stream,
  options: { temperature: input.temperature ?? conn.temperature ?? DEFAULT_OLLAMA_TEMPERATURE },
})

const mapOllamaError = (cause: unknown): AiError => {
  if (cause instanceof AiProviderError) return cause
  return new AiProviderError({
    statusCode: 502,
    message: `Ollama request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  })
}

/** POST to Ollama's `/api/chat` (non-streaming) and reduce to a {@link ChatReply}. */
export const ollamaChat = (conn: OllamaConn, input: ChatInput): Effect.Effect<ChatReply, AiError> =>
  Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.defaultModel
      const response = await fetch(ollamaUrl(conn.baseUrl), {
        method: 'POST',
        headers: ollamaHeaders(conn.apiKey),
        body: JSON.stringify(ollamaBody(conn, input, false)),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new AiProviderError({
          statusCode: response.status,
          message: `Ollama returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }
      const payload = (await response.json()) as OllamaChatPayload
      const content = payload.message?.content
      if (typeof content !== 'string') {
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new AiProviderError({
          statusCode: 502,
          message: 'Ollama returned a malformed chat response',
        })
      }
      return { content, model: payload.model ?? model } satisfies ChatReply
    },
    catch: mapOllamaError,
  })

/** Stream variant: issues a non-streaming Ollama request and emits the reply
 * as a single `content` chunk followed by the terminating `done` chunk. */
export const ollamaChatStream = (
  conn: OllamaConn,
  input: ChatInput
): Stream.Stream<ChatChunk, AiError> =>
  Stream.unwrap(
    ollamaChat(conn, input).pipe(
      Effect.map((reply): Stream.Stream<ChatChunk, AiError> => {
        const chunks: ReadonlyArray<ChatChunk> = [
          { type: 'content', delta: reply.content },
          { type: 'done', model: reply.model },
        ]
        return Stream.fromIterable(chunks)
      })
    )
  )
