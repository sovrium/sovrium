/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `AiService` port's `chat` and `chatStream`, spoken over an `effect/ai`
 * `LanguageModel` ([internal ref] D1, D3).
 *
 * This file is the translation seam between Sovrium's types and Effect's: it
 * turns a `ChatInput` into a `Prompt` plus a toolkit, runs ONE model call, and
 * turns the result back into a `ChatReply` or a stream of `ChatChunk`s. It is
 * provider-agnostic — the OpenAI-compatible provider and the native Ollama one
 * both arrive here as a `LanguageModel` plus a {@link ProviderCall} that scopes
 * the call's model and sampling onto it.
 *
 * Three decisions from [internal ref] live here:
 *
 *  - **tool calls are never resolved by `effect/ai`**: every call runs with
 *    `disableToolCallResolution: true` and `toolCallValidation: 'deferred'`, so
 *    the model's calls come back to the agent runtime as data and run through
 *    its gates, one at a time;
 *  - **reasoning is split out**: a provider's own reasoning field and the
 *    `<think>` convention of open reasoning models both become `reasoning`;
 *  - **every failure is a port error**: a deadline is `AiTimeoutError`, an
 *    HTTP status is `AiProviderError` carrying it, a malformed reply is a 502.
 */

import { Duration, Effect, Stream } from 'effect'
import * as AiError from 'effect/ai/AiError'
import * as LanguageModel from 'effect/ai/LanguageModel'
import {
  AiProviderError,
  AiTimeoutError,
  type AiError as PortAiError,
  type ChatChunk,
  type ChatFinishReason,
  type ChatInput,
  type ChatReply,
  type ChatToolCall,
  type ChatUsage,
} from '@/application/ports/services/ai-service'
import {
  DEFAULT_CHAT_REQUEST_TIMEOUT_MS,
  EGRESS_TIMEOUT_MARKER,
  EgressPolicy,
  STREAM_HEADERS_TIMEOUT_MS,
} from '@/infrastructure/egress/bounded-http-client'
import { callOptions, toPrompt } from './language-model-prompt'
import { createThinkTagSplitter, splitThinkTags, type SplitPiece } from './think-tag-splitter'
import type * as Response from 'effect/ai/Response'
import type * as Tool from 'effect/ai/Tool'

/**
 * How one provider scopes a call's settings — model, sampling, output budget,
 * structured-output constraint — onto the `LanguageModel` call. Each provider
 * package has its own config service, so each provides its own.
 */
export interface ProviderCall {
  readonly effect: <A, E>(
    self: Effect.Effect<A, E, LanguageModel.LanguageModel>
  ) => Effect.Effect<A, E, LanguageModel.LanguageModel>
  readonly stream: <A, E>(
    self: Stream.Stream<A, E, LanguageModel.LanguageModel>
  ) => Stream.Stream<A, E, LanguageModel.LanguageModel>
}

/** Build a provider's call scope from the call's input and its resolved model. */
export type ProviderCallFor = (input: ChatInput, model: string) => ProviderCall

// ---------------------------------------------------------------------------
// Result -> ChatReply / ChatChunk
// ---------------------------------------------------------------------------

const FINISH_REASONS: Readonly<Record<Response.FinishReason, ChatFinishReason>> = {
  stop: 'stop',
  length: 'length',
  'tool-calls': 'tool-calls',
  error: 'error',
  'content-filter': 'error',
  pause: 'stop',
  other: 'stop',
  unknown: 'stop',
}

const toFinishReason = (reason: Response.FinishReason): ChatFinishReason => FINISH_REASONS[reason]

const toUsage = (usage: Response.Usage): ChatUsage | undefined => {
  const input = usage.inputTokens.total ?? usage.inputTokens.uncached
  const output = usage.outputTokens.total
  if (input === undefined && output === undefined) return undefined
  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    totalTokens: (input ?? 0) + (output ?? 0),
  }
}

/** A tool call's parameters as the port's argument record; anything else is `{}`. */
const toArguments = (params: unknown): Record<string, unknown> =>
  typeof params === 'object' && params !== null && !Array.isArray(params)
    ? (params as Record<string, unknown>)
    : {}

/** Model-requested (never provider-executed) tool calls, in the port's shape. */
const toToolCalls = (
  parts: ReadonlyArray<Response.AnyPart>
): ReadonlyArray<ChatToolCall> | undefined => {
  const calls = parts
    .filter((part): part is Response.ToolCallPart<string, unknown> => part.type === 'tool-call')
    .filter((part) => part.providerExecuted !== true)
    .map((part) => ({ id: part.id, name: part.name, arguments: toArguments(part.params) }))
  return calls.length > 0 ? calls : undefined
}

const modelIdOf = (parts: ReadonlyArray<Response.AnyPart>, fallback: string): string => {
  const metadata = parts.find(
    (part): part is Response.ResponseMetadataPart => part.type === 'response-metadata'
  )
  return metadata?.modelId ?? fallback
}

/** A buffered reply: text with any `<think>` block split out, tool calls, usage. */
const toChatReply = (
  response: Pick<
    LanguageModel.GenerateTextResponse<Record<string, Tool.Any>, 'deferred'>,
    'content' | 'text' | 'reasoningText' | 'usage' | 'finishReason'
  >,
  model: string
): ChatReply => {
  const parts = response.content as ReadonlyArray<Response.AnyPart>
  const toolCalls = toToolCalls(parts)
  const split = splitThinkTags(response.text)
  const reasoning = [response.reasoningText ?? '', split.reasoning].join('')
  const usage = toUsage(response.usage)
  return {
    content: split.content,
    model: modelIdOf(parts, model),
    ...(toolCalls !== undefined && { toolCalls }),
    ...(reasoning.length > 0 && { reasoning }),
    finishReason: toolCalls !== undefined ? 'tool-calls' : toFinishReason(response.finishReason),
    ...(usage !== undefined && { usage }),
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

interface HttpCarrying {
  readonly http?: { readonly response?: { readonly status: number }; readonly body?: string }
}

/**
 * An `effect/ai` failure as a port error. The status a provider answered is
 * kept on `AiProviderError` so a route can map it; a deadline — the bounded
 * client's or the adapter's own — is `AiTimeoutError`.
 */
export const toPortError = (error: AiError.AiError, timeoutMs: number): PortAiError => {
  const { reason } = error
  if (reason._tag === 'NetworkError') {
    if (reason.description?.includes(EGRESS_TIMEOUT_MARKER) === true) {
      return timeoutError(timeoutMs)
    }
    return new AiProviderError({
      statusCode: 502,
      message: `AI provider request failed: ${reason.description ?? reason.reason}`,
      cause: error,
    })
  }
  const { http } = reason as HttpCarrying
  if (http?.response !== undefined) {
    const { status } = http.response
    return new AiProviderError({
      statusCode: status,
      message: `AI provider returned HTTP ${String(status)}: ${(http.body ?? '').slice(0, 200)}`,
      cause: error,
    })
  }
  // A provider answer that does not decode. `@effect/ai-openai-compat` reports it
  // as `InvalidResponseError` since 4.0.6 (it was `InvalidOutputError`, which
  // now means only model-generated output that failed validation); the Ollama
  // adapter still raises `InvalidOutputError`. Both are the same malformed reply.
  if (reason._tag === 'InvalidResponseError' || reason._tag === 'InvalidOutputError') {
    return new AiProviderError({
      statusCode: 502,
      message: `AI provider returned a malformed chat-completion response: ${reason.message}`,
      cause: error,
    })
  }
  return new AiProviderError({ statusCode: 502, message: reason.message, cause: error })
}

const timeoutError = (timeoutMs: number): AiTimeoutError =>
  new AiTimeoutError({
    message: 'AI provider request timed out before a response was received.',
    timeoutMs,
  })

/** An `effect/ai` failure, or one of ours raised while building the prompt. */
const mapFailure =
  (timeoutMs: number) =>
  (error: AiError.AiError | PortAiError): PortAiError =>
    AiError.isAiError(error) ? toPortError(error, timeoutMs) : error

// ---------------------------------------------------------------------------
// The two port methods
// ---------------------------------------------------------------------------

/**
 * The whole-call deadline of a buffered call. The caller's, when it named one;
 * otherwise enough for every retry the bounded client may spend at its own
 * per-attempt deadline, so the adapter never cuts short a retry it allowed.
 */
const bufferedDeadlineMs = (input: ChatInput): number =>
  input.timeoutMs ?? DEFAULT_CHAT_REQUEST_TIMEOUT_MS * 3

/**
 * One buffered model call.
 *
 * A caller that names a deadline is promising its latency, so its call is
 * never retried behind its back; a caller that names none is retried on a
 * transient failure, as it always has been.
 */
export const languageModelChat = (
  input: ChatInput,
  model: string,
  provider: ProviderCall
): Effect.Effect<ChatReply, PortAiError, LanguageModel.LanguageModel> => {
  const deadline = bufferedDeadlineMs(input)
  return Effect.gen(function* () {
    const prompt = yield* toPrompt(input.messages)
    const response = yield* provider.effect(LanguageModel.generateText(callOptions(prompt, input)))
    return toChatReply(response, model)
  }).pipe(
    Effect.provideService(EgressPolicy, {
      timeoutMs: input.timeoutMs ?? DEFAULT_CHAT_REQUEST_TIMEOUT_MS,
      retry: input.retry !== false && input.timeoutMs === undefined,
      redirect: 'follow',
    }),
    Effect.mapError(mapFailure(deadline)),
    Effect.timeoutOrElse({
      duration: Duration.millis(deadline),
      orElse: () => Effect.fail(timeoutError(deadline)),
    })
  )
}

/** Split text pieces as port chunks. */
const pieceChunks = (pieces: readonly SplitPiece[]): readonly ChatChunk[] =>
  pieces.map((piece) => ({
    type: piece.kind === 'reasoning' ? ('reasoning' as const) : ('content' as const),
    delta: piece.text,
  }))

/** The streamed parts of one call, as port chunks, `<think>` blocks split out. */
const toChunks = (model: string) => {
  const splitter = createThinkTagSplitter()
  return (part: Response.StreamPart<Record<string, Tool.Any>>): readonly ChatChunk[] => {
    if (part.type === 'text-delta') return pieceChunks(splitter.feed(part.delta))
    if (part.type === 'reasoning-delta') {
      return part.delta.length > 0 ? [{ type: 'reasoning', delta: part.delta }] : []
    }
    if (part.type === 'tool-call') {
      return part.providerExecuted === true
        ? []
        : [
            {
              type: 'tool_call',
              id: part.id,
              name: part.name,
              arguments: toArguments(part.params),
            },
          ]
    }
    if (part.type !== 'finish') return []
    const usage = toUsage(part.usage)
    return [
      ...pieceChunks(splitter.flush()),
      {
        type: 'done',
        model,
        finishReason: toFinishReason(part.reason),
        ...(usage !== undefined && { usage }),
      },
    ]
  }
}

/**
 * One streamed model call.
 *
 * Never retried: once a byte is out, a second attempt would splice two
 * generations together. The headers get the stream deadline; after that, each
 * wait for the next part gets an IDLE deadline that FAILS the stream —
 * `Stream.timeout` would end it silently, and a truncated answer would read as
 * a whole one. A stream the provider cut short ends without `done`.
 */
export const languageModelChatStream = (
  input: ChatInput,
  model: string,
  provider: ProviderCall
): Stream.Stream<ChatChunk, PortAiError, LanguageModel.LanguageModel> => {
  const idleMs = input.timeoutMs ?? DEFAULT_CHAT_REQUEST_TIMEOUT_MS
  return Stream.unwrap(
    Effect.map(toPrompt(input.messages), (prompt) => {
      // One splitter per call: a `<think>` tag may straddle two deltas.
      const chunksOf = toChunks(model)
      return provider.stream(LanguageModel.streamText(callOptions(prompt, input))).pipe(
        Stream.mapError(mapFailure(STREAM_HEADERS_TIMEOUT_MS)),
        Stream.timeoutOrElse({
          duration: Duration.millis(idleMs),
          orElse: () => Stream.fail(timeoutError(idleMs)),
        }),
        Stream.flatMap((part) => Stream.fromIterable(chunksOf(part)))
      )
    })
  ).pipe(
    Stream.provideService(EgressPolicy, {
      timeoutMs: STREAM_HEADERS_TIMEOUT_MS,
      retry: false,
      redirect: 'follow',
    })
  )
}
