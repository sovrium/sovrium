/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { blankToUndefined } from '@/domain/kernel/config-parsing/blank-text'

/**
 * AI environment configuration.
 *
 * Env vars: AI_PROVIDER, AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_TEMPERATURE,
 *           AI_MAX_TOKENS, AI_EMBEDDING_MODEL, AI_EMBEDDING_DIMENSIONS
 */
export const AiEnvSchema = Schema.Struct({
  provider: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'AI provider identifier (AI_PROVIDER)',
        examples: ['openai', 'anthropic', 'ollama'],
      })
    )
  ),
  apiKey: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'API key for the AI provider (AI_API_KEY)',
      })
    )
  ),
  baseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isPattern(/^https?:\/\/.+/)),
      Schema.annotate({
        description: 'Base URL for the AI provider API (AI_BASE_URL)',
        examples: ['https://api.openai.com/v1', 'http://localhost:11434'],
      })
    )
  ),
  model: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Default LLM model identifier (AI_MODEL)',
        examples: ['claude-sonnet-4-5', 'gpt-4o-mini', 'llama3'],
      })
    )
  ),
  temperature: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1)),
      Schema.annotate({
        description: 'Default LLM temperature 0-1 inclusive (AI_TEMPERATURE)',
      })
    )
  ),
  maxTokens: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Default maximum output tokens (AI_MAX_TOKENS)',
      })
    )
  ),
  embeddingModel: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Embedding model identifier (AI_EMBEDDING_MODEL)',
        examples: ['text-embedding-3-small', 'nomic-embed-text'],
      })
    )
  ),
  embeddingDimensions: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Embedding vector dimensions (AI_EMBEDDING_DIMENSIONS)',
        examples: [1536],
      })
    )
  ),
})

export type AiEnvConfig = Schema.Schema.Type<typeof AiEnvSchema>

/** @public */
export const parseAiEnvConfig = (env: Readonly<Record<string, string | undefined>>): AiEnvConfig =>
  Schema.decodeSync(AiEnvSchema)({
    provider: blankToUndefined(env['AI_PROVIDER']),
    apiKey: blankToUndefined(env['AI_API_KEY']),
    baseUrl: blankToUndefined(env['AI_BASE_URL']),
    model: blankToUndefined(env['AI_MODEL']),
    temperature: blankToUndefined(env['AI_TEMPERATURE']),
    maxTokens: blankToUndefined(env['AI_MAX_TOKENS']),
    embeddingModel: blankToUndefined(env['AI_EMBEDDING_MODEL']),
    embeddingDimensions: blankToUndefined(env['AI_EMBEDDING_DIMENSIONS']),
  })
