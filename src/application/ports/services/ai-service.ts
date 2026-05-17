/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect, Stream } from 'effect'

/**
 * AI provider tagged errors.
 *
 * The shape mirrors the audit recommendation (see
 * `docs/architecture/audits/ai-test-infra-audit-2026-05-11.md` § P0-1):
 * concrete tags so route handlers can map upstream failures onto HTTP
 * status codes without losing context. Additional tags (rate-limit,
 * timeout, invalid-response) will be added when their driving specs land.
 */

/**
 * Provider returned a non-2xx HTTP response.
 *
 * `statusCode` preserves the upstream status so the Hono route can return a
 * sensible client status (e.g. 502 Bad Gateway when the provider 5xx-ed).
 */
export class AiProviderError extends Data.TaggedError('AiProviderError')<{
  readonly statusCode: number
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Required AI env vars are missing or malformed.
 *
 * Distinct from `AiProviderError` so the route can return 503 Service
 * Unavailable instead of 502 when the server itself is misconfigured.
 */
export class AiConfigError extends Data.TaggedError('AiConfigError')<{
  readonly message: string
}> {}

/** Union of all errors surfaced by the `AiService` port. */
export type AiError = AiProviderError | AiConfigError

// ---------------------------------------------------------------------------
// Message + chat-completion shapes
// ---------------------------------------------------------------------------

/** A single chat message in OpenAI-compatible format. */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** Input to {@link AiService.chat}. */
export interface ChatInput {
  /** Message history in chronological order. Must include at least one user message. */
  readonly messages: ReadonlyArray<ChatMessage>
  /** Override the configured model for this request. */
  readonly model?: string
  /** Override the configured temperature for this request. */
  readonly temperature?: number
  /** Override the configured maximum output tokens for this request. */
  readonly maxTokens?: number
  /**
   * OpenAI-compatible structured-output constraint. When set, it is passed
   * through verbatim as the provider request body's `response_format` field
   * (e.g. `{ type: 'json_schema', json_schema: { schema: <JSON Schema> } }`).
   * Used by `ai:extract` to constrain the reply to a caller-supplied schema.
   */
  readonly responseFormat?: Record<string, unknown>
}

/** Result of a successful {@link AiService.chat} call. */
export interface ChatReply {
  /** The assistant message text. */
  readonly content: string
  /** The model that produced the reply (echoed from the provider response). */
  readonly model: string
}

/**
 * A single chunk emitted by {@link AiService.chatStream}.
 *
 * Mirrors the OpenAI-compatible streaming SSE chunk shape: each `content`
 * chunk carries a `delta` (incremental text since the previous chunk), and
 * a terminal `done` marker signals end-of-stream. Tool-call chunks land in
 * later P0-2 specs and are intentionally NOT part of this v1 surface.
 *
 * Consumers assemble the full reply by concatenating every `content` delta
 * in order until the `done` chunk arrives. The `model` echo on the `done`
 * chunk matches `ChatReply.model` for non-streaming calls so symmetric code
 * paths (e.g. persistence) can reuse the same field.
 */
export type ChatChunk =
  | { readonly type: 'content'; readonly delta: string }
  | { readonly type: 'done'; readonly model: string }

// ---------------------------------------------------------------------------
// AiService port
// ---------------------------------------------------------------------------

/**
 * AI Service Port
 *
 * Provides AI chat-completion operations against an OpenAI-compatible
 * endpoint. The live adapter (`AiServiceLive`) reads provider configuration
 * from env vars (`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`).
 *
 * Exposes two SEPARATE methods for the two transports:
 *   - `chat`        — buffered, one-shot completion (HTTP JSON in/out).
 *   - `chatStream`  — incremental delta stream (HTTP SSE response).
 *
 * Keeping them separate (rather than collapsing `chat` into "always returns
 * a stream") means callers that don't need streaming — notably
 * `AiComputeListener` for inline AI fields — keep the simple
 * `Effect<ChatReply, AiError>` shape and never have to `Stream.runCollect`.
 *
 * When the provider is not configured (no `AI_PROVIDER` env var), the live
 * adapter returns a no-op stub whose `chat` method fails with
 * `AiConfigError` and whose `chatStream` returns `Stream.fail(AiConfigError)`.
 * Routes map this onto HTTP 503 so callers can detect the "not configured"
 * state without crashing the server at startup. This mirrors the Storage
 * service's no-storage fallback contract.
 */
export class AiService extends Context.Tag('AiService')<
  AiService,
  {
    /** Non-streaming chat completion. Returns the assistant message text. */
    readonly chat: (input: ChatInput) => Effect.Effect<ChatReply, AiError>
    /**
     * Streaming chat completion. Emits `content` chunks as the provider
     * produces tokens, terminated by a single `done` chunk. Errors raised
     * before or during the stream surface on the `AiError` channel.
     */
    readonly chatStream: (input: ChatInput) => Stream.Stream<ChatChunk, AiError>
    /** True when the live adapter found AI env vars; false for the no-op stub. */
    readonly isConfigured: () => boolean
  }
>() {}
