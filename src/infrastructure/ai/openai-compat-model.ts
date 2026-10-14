/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The OpenAI-compatible provider, through `@effect/ai-openai-compat`
 * ([internal ref] D1).
 *
 * Every configured cloud provider — OpenAI, Mistral, Anthropic through its
 * compatible endpoint, any self-hosted server — is reached here, at
 * `${AI_BASE_URL}/chat/completions`, over the bounded `HttpClient` of D5.
 *
 * The request stays the one this adapter always sent: `model`, `messages`,
 * `temperature`, `max_tokens`, `tools` when the call advertises any, and a
 * structured-output constraint as `response_format`, VERBATIM. That last one
 * rides as a custom request property rather than through `generateObject`:
 * its schema is the caller's JSON Schema (an `ai:extract` field list), not an
 * Effect Schema, and the provider package forwards an unknown config key to
 * the wire unchanged. Two differences remain on the wire: each tool carries
 * `strict: false` (the package states strictness explicitly; `false` is what
 * an absent field meant), and a streamed request asks for usage
 * (`stream_options.include_usage`).
 */

import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai-compat'
import { Effect, Layer, Redacted, Stream } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { boundedHttpClientLayer } from '@/infrastructure/egress/bounded-http-client'
import type { ProviderCallFor } from './language-model-chat'
import type { LanguageModel } from 'effect/ai'

/** A resolved OpenAI-compatible endpoint. */
export interface OpenAiCompatConnection {
  readonly baseUrl: string
  readonly apiKey: string
  readonly defaultModel: string
}

/** A choice's message with Mistral's `"tool_calls": null` dropped, every other key kept. */
export const dropNullToolCalls = (payload: unknown): unknown => {
  if (typeof payload !== 'object' || payload === null) return payload
  const { choices } = payload as { readonly choices?: unknown }
  if (!Array.isArray(choices)) return payload
  return {
    ...payload,
    choices: choices.map((choice: unknown) => {
      if (typeof choice !== 'object' || choice === null) return choice
      const { message } = choice as { readonly message?: Record<string, unknown> }
      if (message === undefined || message['tool_calls'] !== null) return choice
      const { tool_calls: _dropped, ...rest } = message
      return { ...choice, message: rest }
    }),
  }
}

/**
 * Read Mistral's plain reply the way every other provider's is read.
 *
 * Mistral sends `"tool_calls": null` on every plain answer where OpenAI omits
 * the key, and the provider package's response schema accepts `null` only on
 * streamed deltas, so a buffered Mistral answer would fail to decode. A JSON
 * body has the null dropped before decoding; a stream passes untouched.
 */
const normaliseNullToolCalls = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
  HttpClient.transformResponse(client, (effect) =>
    Effect.flatMap(effect, (response) => {
      const type = response.headers['content-type'] ?? ''
      if (!type.includes('application/json')) return Effect.succeed(response)
      return Effect.map(response.json, (payload) =>
        HttpClientResponse.fromWeb(
          response.request,
          new Response(JSON.stringify(dropNullToolCalls(payload)), {
            status: response.status,
            headers: { 'content-type': 'application/json' },
          })
        )
      )
    })
  )

/** The `LanguageModel` for one endpoint, over the bounded client. */
export const openAiCompatLanguageModelLayer = (
  conn: OpenAiCompatConnection
): Layer.Layer<LanguageModel.LanguageModel> =>
  OpenAiLanguageModel.layer({ model: conn.defaultModel }).pipe(
    Layer.provide(
      OpenAiClient.layer({
        apiUrl: conn.baseUrl,
        apiKey: Redacted.make(conn.apiKey),
        transformClient: normaliseNullToolCalls,
      })
    ),
    Layer.provide(boundedHttpClientLayer())
  )

/** Sampling defaults the adapter applies when a call names none. */
export interface SamplingDefaults {
  readonly temperature: number
  readonly maxTokens: number
}

/**
 * Scope one call's settings onto the provider: the per-call model, sampling and
 * output budget, the structured-output constraint, and non-strict tools.
 */
export const openAiCompatCall =
  (defaults: SamplingDefaults): ProviderCallFor =>
  (input, model) => {
    const overrides = {
      model,
      temperature: input.temperature ?? defaults.temperature,
      max_output_tokens: input.maxTokens ?? defaults.maxTokens,
      strictJsonSchema: false,
      ...(input.responseFormat !== undefined && { response_format: input.responseFormat }),
    }
    return {
      effect: (self) => OpenAiLanguageModel.withConfigOverride(self, overrides),
      stream: (self) => Stream.provideService(self, OpenAiLanguageModel.Config, overrides),
    }
  }
