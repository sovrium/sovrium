/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Stream } from 'effect'
import { AiProviderError } from '@/application/ports/services/ai-service'
import type {
  AiError,
  ChatChunk,
  ChatInput,
  ChatReply,
} from '@/application/ports/services/ai-service'


export interface OllamaConn {
  readonly baseUrl: string
  readonly defaultModel: string
  readonly apiKey: string | undefined
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
        throw new AiProviderError({
          statusCode: response.status,
          message: `Ollama returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }
      const payload = (await response.json()) as OllamaChatPayload
      const content = payload.message?.content
      if (typeof content !== 'string') {
        throw new AiProviderError({
          statusCode: 502,
          message: 'Ollama returned a malformed chat response',
        })
      }
      return { content, model: payload.model ?? model } satisfies ChatReply
    },
    catch: mapOllamaError,
  })

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
