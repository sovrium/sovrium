/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Option, Schema } from 'effect'
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

/**
 * Each AI setting with the variable it is read from and what that variable
 * must hold, phrased for an operator: a refused value is reported under the
 * name they wrote in their environment, never the property behind it.
 */
const AI_ENV_VARIABLES = [
  { key: 'provider', variable: 'AI_PROVIDER', expected: 'a provider name' },
  { key: 'apiKey', variable: 'AI_API_KEY', expected: 'a non-empty key' },
  { key: 'baseUrl', variable: 'AI_BASE_URL', expected: 'an http:// or https:// address' },
  { key: 'model', variable: 'AI_MODEL', expected: 'a model identifier' },
  { key: 'temperature', variable: 'AI_TEMPERATURE', expected: 'a number between 0 and 1' },
  { key: 'maxTokens', variable: 'AI_MAX_TOKENS', expected: 'a positive integer' },
  { key: 'embeddingModel', variable: 'AI_EMBEDDING_MODEL', expected: 'a model identifier' },
  {
    key: 'embeddingDimensions',
    variable: 'AI_EMBEDDING_DIMENSIONS',
    expected: 'a positive integer',
  },
] as const satisfies ReadonlyArray<{
  readonly key: keyof typeof AiEnvSchema.fields
  readonly variable: string
  readonly expected: string
}>

/** The raw environment values, keyed as `AiEnvSchema` expects, blanks dropped. */
const rawAiEnv = (
  env: Readonly<Record<string, string | undefined>>
): Readonly<Record<keyof typeof AiEnvSchema.fields, string | undefined>> =>
  Object.fromEntries(
    AI_ENV_VARIABLES.map(({ key, variable }) => [key, blankToUndefined(env[variable])])
  ) as Record<keyof typeof AiEnvSchema.fields, string | undefined>

/**
 * The first AI variable whose value `AiEnvSchema` refuses, as a sentence naming
 * the variable, what it accepts and the value it was given; `undefined` when
 * every set variable is valid. A blank value counts as unset.
 */
export const aiEnvRefusal = (
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const raw = rawAiEnv(env)
  const refused = AI_ENV_VARIABLES.find(({ key }) => {
    const value = raw[key]
    if (value === undefined) return false
    const field = Schema.Struct({ value: AiEnvSchema.fields[key] })
    return Option.isNone(Schema.decodeOption(field)({ value }))
  })
  return refused === undefined
    ? undefined
    : `${refused.variable} must be ${refused.expected} (got "${raw[refused.key]}").`
}

/**
 * The AI settings decoded from the environment. Callers that boot a server
 * check {@link aiEnvRefusal} first, so an operator reads the variable's name
 * rather than this decode's property path.
 *
 * @public
 */
export const parseAiEnvConfig = (env: Readonly<Record<string, string | undefined>>): AiEnvConfig =>
  Schema.decodeSync(AiEnvSchema)(rawAiEnv(env))
