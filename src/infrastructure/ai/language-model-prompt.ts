/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A port `ChatInput` as what an `effect/ai` model call takes: the messages as
 * a `Prompt`, the advertised tools as dynamic tools, and the options under
 * which the agent runtime — never `effect/ai` — resolves every tool call.
 */

import { Effect } from 'effect'
import * as Tool from 'effect/ai/Tool'
import * as Toolkit from 'effect/ai/Toolkit'
import {
  AiConfigError,
  messageText,
  type ChatInput,
  type ChatMessage,
} from '@/application/ports/services/ai-service'
import type * as Prompt from 'effect/ai/Prompt'

// ---------------------------------------------------------------------------
// ChatInput -> Prompt
// ---------------------------------------------------------------------------

/** The tool name a `role: 'tool'` message answers, read off the assistant call it names. */
const toolNameOf = (messages: readonly ChatMessage[], toolCallId: string | undefined): string =>
  messages.flatMap((message) => message.toolCalls ?? []).find((call) => call.id === toolCallId)
    ?.name ?? ''

/**
 * A user message's parts as `effect/ai` encodes them. A `file` part is a
 * bucket reference that `attachment-parts.ts` resolves before the prompt is
 * built; one that reaches here unresolved fails closed rather than being
 * dropped, so a model never answers as if it had read a file it was never shown.
 */
const userParts = (
  content: ChatMessage['content']
): Effect.Effect<string | readonly Prompt.UserMessagePartEncoded[], AiConfigError> => {
  if (typeof content === 'string') return Effect.succeed(content)
  if (content.some((part) => part.type === 'file')) {
    return Effect.fail(
      new AiConfigError({ message: 'A file attachment reached the model without being read.' })
    )
  }
  return Effect.succeed(
    content.flatMap((part): Prompt.UserMessagePartEncoded[] =>
      part.type === 'text'
        ? [{ type: 'text', text: part.text }]
        : part.type === 'image'
          ? [{ type: 'file', mediaType: part.mediaType, data: part.data }]
          : []
    )
  )
}

const toPromptMessage = (
  message: ChatMessage,
  all: readonly ChatMessage[]
): Effect.Effect<Prompt.MessageEncoded, AiConfigError> => {
  switch (message.role) {
    case 'system':
      return Effect.succeed({ role: 'system', content: messageText(message.content) })
    case 'user':
      return Effect.map(userParts(message.content), (content) => ({ role: 'user', content }))
    case 'assistant':
      return Effect.succeed({
        role: 'assistant',
        content: [
          // Kept even when empty: the OpenAI-compatible wire then carries
          // `content: ""` beside `tool_calls`, as it always has, rather than
          // `null`, which some providers refuse.
          { type: 'text', text: messageText(message.content) },
          ...(message.toolCalls ?? []).map((call) => ({
            type: 'tool-call' as const,
            id: call.id,
            name: call.name,
            params: call.arguments,
          })),
        ],
      })
    case 'tool':
      return Effect.succeed({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            id: message.toolCallId ?? '',
            name: toolNameOf(all, message.toolCallId),
            isFailure: false,
            result: messageText(message.content),
          },
        ],
      })
  }
}

export const toPrompt = (
  messages: readonly ChatMessage[]
): Effect.Effect<readonly Prompt.MessageEncoded[], AiConfigError> =>
  Effect.forEach(messages, (message) => toPromptMessage(message, messages))

/** The advertised tools as `effect/ai` dynamic tools: a name, a description, a JSON Schema. */
const toToolkit = (input: ChatInput) =>
  Toolkit.make(
    ...(input.tools ?? []).map((definition) =>
      Tool.dynamic(definition.function.name, {
        description: definition.function.description,
        parameters: definition.function.parameters as Tool.Dynamic<
          string,
          {
            readonly parameters: never
            readonly success: never
            readonly failure: never
            readonly failureMode: 'error'
          }
        >['jsonSchema'] &
          object,
      })
    )
  )

/** The options of one model call: the runtime resolves every tool call itself. */
export const callOptions = (prompt: readonly Prompt.MessageEncoded[], input: ChatInput) => ({
  prompt,
  toolkit: toToolkit(input),
  disableToolCallResolution: true as const,
  toolCallValidation: 'deferred' as const,
})
