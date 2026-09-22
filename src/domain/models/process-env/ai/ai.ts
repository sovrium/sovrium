/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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

/**
 * Normalize an env-var value: an empty or whitespace-only string is treated as
 * "unset" (`undefined`). Operators who blank out `AI_PROVIDER` (or any AI_*
 * var) intend to disable that setting, not supply an invalid value — this
 * mirrors the "treats an empty AI_PROVIDER the same as unset" contract already
 * enforced by `validate-ai-configuration.ts` and keeps `parseAiEnvConfig`
 * total instead of throwing a `ParseError` at server boot
 *.
 */
const blankToUndefined = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** @public */
export const parseAiEnvConfig = (): AiEnvConfig =>
  Schema.decodeSync(AiEnvSchema)({
    provider: blankToUndefined(process.env.AI_PROVIDER),
    apiKey: blankToUndefined(process.env.AI_API_KEY),
    baseUrl: blankToUndefined(process.env.AI_BASE_URL),
    model: blankToUndefined(process.env.AI_MODEL),
    temperature: blankToUndefined(process.env.AI_TEMPERATURE),
    maxTokens: blankToUndefined(process.env.AI_MAX_TOKENS),
    embeddingModel: blankToUndefined(process.env.AI_EMBEDDING_MODEL),
    embeddingDimensions: blankToUndefined(process.env.AI_EMBEDDING_DIMENSIONS),
  })
