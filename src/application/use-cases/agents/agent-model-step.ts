/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One model call of an agent turn, as the stream of what the model produced
 * and then the reply it assembled — buffered for a surface that answers whole,
 * streamed for one that forwards each delta as it comes.
 */

import { Effect, Stream } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import type {
  AiError,
  ChatInput,
  ChatReply,
  ChatToolCall,
} from '@/application/ports/services/ai-service'

/** A step's stream: the model's events, then the reply they assembled. */
export type StepItem =
  | {
      readonly kind: 'event'
      readonly event: { readonly type: 'content' | 'reasoning'; readonly delta: string }
    }
  | { readonly kind: 'reply'; readonly reply: ChatReply }

/** One buffered model call, as the events a stream would have carried. */
export const bufferedStep = (
  callModel: ((input: ChatInput) => Effect.Effect<ChatReply, AiError, AiService>) | undefined,
  input: ChatInput
): Stream.Stream<StepItem, AiError, AiService> =>
  Stream.fromEffect(
    callModel === undefined
      ? Effect.flatMap(Effect.service(AiService), (ai) => ai.chat(input))
      : callModel(input)
  ).pipe(
    Stream.flatMap((reply) =>
      Stream.fromIterable<StepItem>([
        ...(reply.reasoning !== undefined && reply.reasoning.length > 0
          ? [
              {
                kind: 'event' as const,
                event: { type: 'reasoning' as const, delta: reply.reasoning },
              },
            ]
          : []),
        ...(reply.content.length > 0
          ? [{ kind: 'event' as const, event: { type: 'content' as const, delta: reply.content } }]
          : []),
        { kind: 'reply', reply },
      ])
    )
  )

interface StreamedReply {
  readonly content: string
  readonly reasoning: string
  readonly toolCalls: ReadonlyArray<ChatToolCall>
}

/**
 * One streamed model call: its deltas forwarded as they come, its tool calls
 * collected, and its reply assembled when the provider says `done`. A stream
 * that ends without `done` yields no reply, and the turn ends there.
 */
export const streamedStep = (input: ChatInput): Stream.Stream<StepItem, AiError, AiService> =>
  Stream.unwrap(Effect.map(Effect.service(AiService), (ai) => ai.chatStream(input))).pipe(
    Stream.mapAccum(
      (): StreamedReply => ({ content: '', reasoning: '', toolCalls: [] }),
      (acc, chunk): readonly [StreamedReply, readonly StepItem[]] => {
        switch (chunk.type) {
          case 'content':
            return [
              { ...acc, content: acc.content + chunk.delta },
              [{ kind: 'event', event: { type: 'content', delta: chunk.delta } }],
            ]
          case 'reasoning':
            return [
              { ...acc, reasoning: acc.reasoning + chunk.delta },
              [{ kind: 'event', event: { type: 'reasoning', delta: chunk.delta } }],
            ]
          case 'tool_call':
            return [
              {
                ...acc,
                toolCalls: [
                  ...acc.toolCalls,
                  { id: chunk.id, name: chunk.name, arguments: chunk.arguments },
                ],
              },
              [],
            ]
          case 'done':
            return [
              acc,
              [
                {
                  kind: 'reply',
                  reply: {
                    content: acc.content,
                    model: chunk.model,
                    ...(acc.toolCalls.length > 0 && { toolCalls: acc.toolCalls }),
                    ...(acc.reasoning.length > 0 && { reasoning: acc.reasoning }),
                    ...(chunk.finishReason !== undefined && { finishReason: chunk.finishReason }),
                    ...(chunk.usage !== undefined && { usage: chunk.usage }),
                  },
                },
              ],
            ]
        }
      }
    )
  )
