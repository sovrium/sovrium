/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AiProviderError } from '@/application/ports/services/ai-service'
import type { AiError, EmbedInput, EmbedReply } from '@/application/ports/services/ai-service'


export const DEFAULT_CLOUD_EMBEDDING_MODEL = 'text-embedding-3-small'

export const DEFAULT_OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text'

interface OpenAiEmbeddingPayload {
  readonly data?: ReadonlyArray<{ readonly embedding?: ReadonlyArray<number> }>
  readonly model?: string
}

interface OllamaEmbeddingPayload {
  readonly embedding?: ReadonlyArray<number>
}

export interface EmbedConn {
  readonly baseUrl: string
  readonly apiKey: string | undefined
  readonly model: string
}

const mapEmbedError = (cause: unknown): AiError => {
  if (cause instanceof AiProviderError) return cause
  return new AiProviderError({
    statusCode: 502,
    message: `AI embedding request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  })
}

export const embedOpenAi = (
  conn: EmbedConn,
  input: EmbedInput
): Effect.Effect<EmbedReply, AiError> =>
  Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.model
      const response = await fetch(`${conn.baseUrl.replace(/\/+$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(conn.apiKey !== undefined ? { Authorization: `Bearer ${conn.apiKey}` } : {}),
        },
        body: JSON.stringify({ model, input: input.text }),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new AiProviderError({
          statusCode: response.status,
          message: `AI provider returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }
      const payload = (await response.json()) as OpenAiEmbeddingPayload
      const embedding = payload.data?.[0]?.embedding
      if (embedding === undefined) {
        throw new AiProviderError({
          statusCode: 502,
          message: 'AI provider returned a malformed embedding response',
        })
      }
      return { embedding, model: payload.model ?? model } satisfies EmbedReply
    },
    catch: mapEmbedError,
  })

export const embedOllama = (
  conn: EmbedConn,
  input: EmbedInput
): Effect.Effect<EmbedReply, AiError> =>
  Effect.tryPromise({
    try: async () => {
      const model = input.model ?? conn.model
      const response = await fetch(`${conn.baseUrl.replace(/\/+$/, '')}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(conn.apiKey !== undefined ? { Authorization: `Bearer ${conn.apiKey}` } : {}),
        },
        body: JSON.stringify({ model, prompt: input.text }),
      })
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new AiProviderError({
          statusCode: response.status,
          message: `AI provider returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }
      const payload = (await response.json()) as OllamaEmbeddingPayload
      if (payload.embedding === undefined) {
        throw new AiProviderError({
          statusCode: 502,
          message: 'AI provider returned a malformed embedding response',
        })
      }
      return { embedding: payload.embedding, model } satisfies EmbedReply
    },
    catch: mapEmbedError,
  })
