/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { ChatToolDefinition } from '@/domain/models/app/agents/ai-chat-tools'
import type { Effect, Stream } from 'effect'

export type { ChatToolDefinition } from '@/domain/models/app/agents/ai-chat-tools'

/**
 * AI provider tagged errors.
 *
 * The shape mirrors the audit recommendation (see
 * `[internal ref]` § P0-1):
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

/**
 * The provider call exceeded the caller-supplied `timeoutMs` deadline.
 *
 * Distinct from `AiProviderError` so the route can return 504 Gateway
 * Timeout instead of 502 — a timeout is a deadline breach, not a provider
 * 5xx. The deadline interrupts the request, which aborts its socket.
 */
export class AiTimeoutError extends Data.TaggedError('AiTimeoutError')<{
  readonly message: string
  readonly timeoutMs: number
}> {}

/** Union of all errors surfaced by the `AiService` port. */
export type AiError = AiProviderError | AiConfigError | AiTimeoutError

// ---------------------------------------------------------------------------
// Message + chat-completion shapes
// ---------------------------------------------------------------------------

/**
 * One part of a message's content ([internal ref] D3).
 *
 *  - `text` — prose;
 *  - `image` — bytes the user pasted, inline as base64 with their media type;
 *  - `file` — a REFERENCE into an operator-named bucket, never the bytes: the
 *    infrastructure adapter resolves it, so a caller never holds a file's
 *    content just to hand it to a model.
 */
export type MessagePart =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'image'; readonly mediaType: string; readonly data: string }
  | {
      readonly type: 'file'
      readonly bucket: string
      readonly key: string
      readonly mediaType: string
      readonly name: string
    }

/** A message's content: a string is shorthand for one `text` part. */
export type MessageContent = string | ReadonlyArray<MessagePart>

/**
 * The prose of a message's content: its text parts joined, a string as is.
 *
 * What every caller that persists, logs or pattern-matches a message reads —
 * an image or a file reference has no text to contribute.
 */
export const messageText = (content: MessageContent): string =>
  typeof content === 'string'
    ? content
    : content
        .filter((part): part is Extract<MessagePart, { type: 'text' }> => part.type === 'text')
        .map((part) => part.text)
        .join('\n')

/** A single chat message. */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool'
  readonly content: MessageContent
  /**
   * Tool-call identifier this message answers. Present only on `role: 'tool'`
   * messages — it links a tool-result message back to the `tool_call` the
   * assistant requested (OpenAI-compatible wire field `tool_call_id`).
   */
  readonly toolCallId?: string
  /**
   * Tool calls the assistant requested in this turn. Present only on
   * `role: 'assistant'` messages that emitted `tool_calls` — echoed back into
   * the follow-up request so the provider can correlate the tool results.
   */
  readonly toolCalls?: ReadonlyArray<ChatToolCall>
}

/**
 * A tool call the AI provider requested — extracted from the assistant
 * message's `tool_calls[]`. Arguments are the already-parsed JSON object
 * (the wire format carries them as a JSON string).
 */
export interface ChatToolCall {
  /** Provider-assigned correlation id for this tool call. */
  readonly id: string
  /** The function name the model wants invoked. */
  readonly name: string
  /** The parsed call arguments. */
  readonly arguments: Record<string, unknown>
}

/** Input to `embed`. */
export interface EmbedInput {
  /** The text to embed into a vector. Must be non-empty. */
  readonly text: string
  /** Override the configured embedding model for this request. */
  readonly model?: string
}

/** Result of a successful `embed` call. */
export interface EmbedReply {
  /** The embedding vector produced by the provider. */
  readonly embedding: ReadonlyArray<number>
  /** The embedding model that produced the vector. */
  readonly model: string
}

/** Input to `chat`. */
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
   * OpenAI-compatible structured-output constraint, passed through verbatim as
   * the provider request body's `response_format` field —
   * `{ type: 'json_schema', json_schema: { name: <stable identifier>, schema: <JSON Schema> } }`.
   * `name` is required by Mistral and by OpenAI's strict mode; `ai:extract`
   * always sends one. Used by `ai:extract` to constrain the reply to a
   * caller-supplied schema.
   */
  readonly responseFormat?: Record<string, unknown>
  /**
   * Per-call request deadline in milliseconds. A breach interrupts the call,
   * which aborts its socket, and surfaces as {@link AiTimeoutError}. Unset →
   * the adapter's default deadline. A caller that sets one is also promising
   * its latency: the adapter then never retries the call behind its back.
   */
  readonly timeoutMs?: number
  /**
   * `false` when the caller retries the call itself, under its own policy, so
   * the adapter must not retry it too: retries would multiply, and the number
   * of provider requests would no longer be the one the caller counts. Unset →
   * the adapter retries a transient failure when no {@link timeoutMs} is set.
   */
  readonly retry?: boolean
  /**
   * Function/tool definitions advertised to the AI provider. When set, they
   * are forwarded verbatim as the OpenAI-compatible request body `tools`
   * field so the model may request a tool call. Unset → no tools advertised.
   * Used by the chat route to enable function/tool calling.
   */
  readonly tools?: ReadonlyArray<ChatToolDefinition>
}

/** Tokens one model call consumed, as the provider reported them. */
export interface ChatUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
}

/**
 * Why a model call (or, for the agent runtime, a whole turn) ended.
 *
 *  - `stop` — the model finished its answer;
 *  - `length` — it hit its output-token budget;
 *  - `tool-calls` — it asked for tools (a model call only; a turn resolves them);
 *  - `tool-limit` — the turn hit its step cap with the model still asking for tools;
 *  - `cancelled` — the caller stopped the turn;
 *  - `error` — the provider answered with an error part.
 */
export type ChatFinishReason =
  'stop' | 'length' | 'tool-calls' | 'tool-limit' | 'cancelled' | 'error'

/** Result of a successful `chat` call. */
export interface ChatReply {
  /** The assistant message text. Empty string when the reply is purely tool calls. */
  readonly content: string
  /** The model that produced the reply (echoed from the provider response). */
  readonly model: string
  /**
   * Tool calls the AI provider requested in this turn — present (and
   * non-empty) only when the model responded with tool calls. The agent
   * runtime executes them and loops; the provider never does.
   */
  readonly toolCalls?: ReadonlyArray<ChatToolCall>
  /** Reasoning the provider returned apart from the answer, when it returned any. */
  readonly reasoning?: string
  /** Why the call ended, when the provider said. */
  readonly finishReason?: ChatFinishReason
  /** Tokens the call consumed, when the provider reported them. */
  readonly usage?: ChatUsage
}

/**
 * A single event emitted by {@link AiService.chatStream} ([internal ref] D3).
 *
 * The port emits only what a MODEL produces: answer text (`content`),
 * reasoning it streams apart from the answer (`reasoning`), the tool calls it
 * asks for (`tool_call`, complete — never a partial argument string), and one
 * terminal `done`. Tool results and questions to the user are not model
 * output; the agent runtime adds those to the stream it hands its callers.
 *
 * A stream that ends WITHOUT `done` was cut short by the provider: a consumer
 * must not treat what it collected as a complete answer.
 */
export type ChatChunk =
  | { readonly type: 'content'; readonly delta: string }
  | { readonly type: 'reasoning'; readonly delta: string }
  | {
      readonly type: 'tool_call'
      readonly id: string
      readonly name: string
      readonly arguments: Record<string, unknown>
    }
  | {
      readonly type: 'done'
      readonly model: string
      readonly finishReason?: ChatFinishReason
      readonly usage?: ChatUsage
    }

// ---------------------------------------------------------------------------
// AiService port
// ---------------------------------------------------------------------------

/**
 * AI Service Port
 *
 * Provides AI chat-completion operations. The live adapter (`AiServiceLive`)
 * reads provider configuration from env vars (`AI_PROVIDER`, `AI_BASE_URL`,
 * `AI_API_KEY`, `AI_MODEL`) and speaks to the provider through `effect/ai`,
 * which no caller imports: the port's types are Sovrium's ([internal ref] D7).
 *
 * Cancellation is interruption: interrupting the fiber that runs `chat`, or
 * the one consuming `chatStream`, aborts the provider request.
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
export class AiService extends Context.Service<
  AiService,
  {
    /** Non-streaming chat completion. Returns the assistant message text. */
    readonly chat: (input: ChatInput) => Effect.Effect<ChatReply, AiError>
    /**
     * Streaming chat completion. Emits `content` / `reasoning` deltas as the
     * provider produces tokens and each `tool_call` once complete, terminated
     * by a single `done` chunk. Errors raised before or during the stream
     * surface on the `AiError` channel.
     */
    readonly chatStream: (input: ChatInput) => Stream.Stream<ChatChunk, AiError>
    /**
     * Generate a vector embedding for a piece of text. Routed through the
     * same eco-precedence provider resolution as `chat`
     * (env-controlled, local-first — never a hard-coded cloud provider).
     * Backs the RAG pipeline (the AI RAG requirement-*).
     */
    readonly embed: (input: EmbedInput) => Effect.Effect<EmbedReply, AiError>
    /**
     * The embedding model the live adapter will use — `AI_EMBEDDING_MODEL`
     * when set, otherwise a provider-appropriate default. Used by the RAG
     * config endpoint.
     */
    readonly embeddingModel: () => string
    /** True when the live adapter found AI env vars; false for the no-op stub. */
    readonly isConfigured: () => boolean
  }
>()('AiService') {}
