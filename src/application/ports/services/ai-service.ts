/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { ChatToolDefinition } from '@/domain/services/ai-chat-tools'
import type { Effect, Stream } from 'effect'

export type { ChatToolDefinition } from '@/domain/services/ai-chat-tools'


export class AiProviderError extends Data.TaggedError('AiProviderError')<{
  readonly statusCode: number
  readonly message: string
  readonly cause?: unknown
}> {}

export class AiConfigError extends Data.TaggedError('AiConfigError')<{
  readonly message: string
}> {}

export class AiTimeoutError extends Data.TaggedError('AiTimeoutError')<{
  readonly message: string
  readonly timeoutMs: number
}> {}

export type AiError = AiProviderError | AiConfigError | AiTimeoutError


export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool'
  readonly content: string
  readonly toolCallId?: string
  readonly toolCalls?: ReadonlyArray<ChatToolCall>
}

export interface ChatToolCall {
  readonly id: string
  readonly name: string
  readonly arguments: Record<string, unknown>
}

export interface EmbedInput {
  readonly text: string
  readonly model?: string
}

export interface EmbedReply {
  readonly embedding: ReadonlyArray<number>
  readonly model: string
}

export interface ChatInput {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly model?: string
  readonly temperature?: number
  readonly maxTokens?: number
  readonly responseFormat?: Record<string, unknown>
  readonly timeoutMs?: number
  readonly tools?: ReadonlyArray<ChatToolDefinition>
}

export interface ChatReply {
  readonly content: string
  readonly model: string
  readonly toolCalls?: ReadonlyArray<ChatToolCall>
}

export type ChatChunk =
  | { readonly type: 'content'; readonly delta: string }
  | { readonly type: 'done'; readonly model: string }


export class AiService extends Context.Tag('AiService')<
  AiService,
  {
    readonly chat: (input: ChatInput) => Effect.Effect<ChatReply, AiError>
    readonly chatStream: (input: ChatInput) => Stream.Stream<ChatChunk, AiError>
    readonly embed: (input: EmbedInput) => Effect.Effect<EmbedReply, AiError>
    readonly embeddingModel: () => string
    readonly isConfigured: () => boolean
  }
>() {}
