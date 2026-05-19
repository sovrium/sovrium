/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AiService, AiProviderError } from '@/application/ports/services/ai-service'
import { numberProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type {
  AiError,
  ChatInput,
  ChatMessage,
  ChatReply,
} from '@/application/ports/services/ai-service'


const buildMessages = (
  props: Readonly<Record<string, unknown>>,
  userContent?: string
): ReadonlyArray<ChatMessage> => {
  const systemPrompt = stringProp(props, 'systemPrompt')
  const userMessage: ChatMessage = {
    role: 'user',
    content: userContent ?? stringProp(props, 'prompt'),
  }
  return systemPrompt !== ''
    ? [{ role: 'system', content: systemPrompt }, userMessage]
    : [userMessage]
}

const finiteProp = (props: Readonly<Record<string, unknown>>, key: string): number | undefined => {
  if (props[key] === undefined) return undefined
  const value = numberProp(props, key, Number.NaN)
  return Number.isFinite(value) ? value : undefined
}

const optionalSampling = (
  props: Readonly<Record<string, unknown>>
): Pick<ChatInput, 'temperature' | 'maxTokens'> => {
  const temperature = finiteProp(props, 'temperature')
  const maxTokens = finiteProp(props, 'maxTokens')
  return {
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

export const buildChatInput = (
  props: Readonly<Record<string, unknown>>,
  userContent?: string
): ChatInput => {
  const model = stringProp(props, 'model')
  return {
    messages: buildMessages(props, userContent),
    ...(model !== '' ? { model } : {}),
    ...optionalSampling(props),
  }
}


export interface AiErrorEnvelope {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

const classifyAiError = (err: AiError): AiErrorEnvelope => {
  if (!(err instanceof AiProviderError)) {
    return { code: 'ai_not_configured', message: err.message, retryable: false }
  }
  const { statusCode, message } = err
  if (statusCode === 429) {
    return { code: 'rate_limit_exceeded', message, retryable: true }
  }
  if (statusCode === 401 || statusCode === 403) {
    return {
      code: 'authentication_error',
      message: `AI provider authentication failed (HTTP ${String(statusCode)})`,
      retryable: false,
    }
  }
  if (statusCode === 408 || statusCode === 504) {
    return { code: 'gateway_timeout', message, retryable: true }
  }
  if (statusCode >= 500) {
    return { code: 'provider_unavailable', message, retryable: true }
  }
  return { code: 'provider_error', message, retryable: false }
}

export const aiErrorOutcome = (envelope: AiErrorEnvelope): ActionOutcome => ({
  status: 'success',
  error: `${envelope.code}: ${envelope.message}`,
  output: { error: envelope },
})

export const runAiChat = (
  input: ChatInput
): Effect.Effect<
  { readonly ok: true; readonly reply: ChatReply } | ActionOutcome,
  never,
  AiService
> =>
  Effect.gen(function* () {
    const ai = yield* AiService
    const result = yield* Effect.either(ai.chat(input))
    return result._tag === 'Left'
      ? aiErrorOutcome(classifyAiError(result.left))
      : { ok: true as const, reply: result.right }
  })


export const handleAiGenerate: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    if (stringProp(props, 'prompt') === '') {
      return { status: 'failure', error: 'ai.generate requires a prompt' } as const
    }

    const outcome = yield* runAiChat(buildChatInput(props))
    return 'ok' in outcome
      ? ({ status: 'success', output: { text: outcome.reply.content } } as const)
      : outcome
  })


const classifyCategories = (props: Readonly<Record<string, unknown>>): ReadonlyArray<string> => {
  const raw = props['categories']
  if (!Array.isArray(raw)) return []
  return raw.map((c) => String(c).trim()).filter((c) => c !== '')
}

const classifyUserContent = (
  props: Readonly<Record<string, unknown>>,
  input: string,
  categories: ReadonlyArray<string>
): string => {
  const instruction = stringProp(props, 'prompt')
  const lines = [
    ...(instruction !== '' ? [instruction] : []),
    `Input: ${input}`,
    `Categories: ${categories.join(', ')}`,
    'Respond with exactly one of the categories listed above and nothing else.',
  ]
  return lines.join('\n\n')
}

export const handleAiClassify: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const input = stringProp(props, 'input')
    const categories = classifyCategories(props)
    if (input === '' || categories.length === 0) {
      return {
        status: 'failure',
        error: 'ai.classify requires an input and a non-empty categories list',
      } as const
    }

    const outcome = yield* runAiChat(
      buildChatInput(props, classifyUserContent(props, input, categories))
    )
    if (!('ok' in outcome)) return outcome

    const reply = outcome.reply.content.trim()
    const lowered = reply.toLowerCase()
    const matched =
      categories.find((c) => c.toLowerCase() === lowered) ??
      categories.find((c) => lowered.includes(c.toLowerCase()))
    if (matched === undefined) {
      return {
        status: 'failure',
        error: `ai.classify: response did not match any category (got "${reply}", expected one of ${categories.join(', ')})`,
      } as const
    }

    return { status: 'success', output: { category: matched } } as const
  })


const extractSchema = (
  props: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined => {
  const raw = props['schema']
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const obj = raw as Record<string, unknown>
  return Object.keys(obj).length > 0 ? obj : undefined
}

const extractUserContent = (
  props: Readonly<Record<string, unknown>>,
  input: string,
  schema: Record<string, unknown>
): string => {
  const instruction = stringProp(props, 'prompt')
  const lines = [
    ...(instruction !== '' ? [instruction] : []),
    `Input: ${input}`,
    `Return a JSON object matching this schema: ${JSON.stringify(schema)}`,
    'Respond with only the JSON object and nothing else.',
  ]
  return lines.join('\n\n')
}

const parseJsonReply = (text: string): unknown => {
  const trimmed = text.trim()
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  try {
    return JSON.parse(fenced.trim())
  } catch {
    return undefined
  }
}

export const handleAiExtract: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const input = stringProp(props, 'input')
    const schema = extractSchema(props)
    if (input === '' || schema === undefined) {
      return {
        status: 'failure',
        error: 'ai.extract requires an input and a target schema',
      } as const
    }

    const chatInput = {
      ...buildChatInput(props, extractUserContent(props, input, schema)),
      responseFormat: { type: 'json_schema', json_schema: { schema } },
    }
    const outcome = yield* runAiChat(chatInput)
    if (!('ok' in outcome)) return outcome

    const parsed = parseJsonReply(outcome.reply.content)
    if (parsed === undefined || typeof parsed !== 'object' || parsed === null) {
      return aiErrorOutcome({
        code: 'parse_error',
        message: `ai.extract: response was not a valid JSON object (got "${outcome.reply.content.trim().slice(0, 200)}")`,
        retryable: false,
      })
    }

    return { status: 'success', output: parsed as Record<string, unknown> } as const
  })
