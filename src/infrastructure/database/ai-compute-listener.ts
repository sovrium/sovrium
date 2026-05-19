/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { Client } from 'pg'
import { AiService } from '@/application/ports/services/ai-service'
import { AiLive } from '@/infrastructure/ai/layer'
import { logDebug } from '@/infrastructure/logging/logger'

interface AiComputePayload {
  readonly kind?: 'categorize' | 'summary' | 'translate' | 'extract' | 'sentiment' | 'generate'
  readonly table: string
  readonly field: string
  readonly value: string | undefined
  readonly source: string
  readonly categories?: readonly string[]
  readonly prompt?: string | null
  readonly systemPrompt?: string | null
  readonly model?: string | null
  readonly temperature?: number | null
  readonly maxLength?: number | null
  readonly maxTokens?: number | null
  readonly targetLanguage?: string
  readonly schema?: string
}

export class AiComputeListener {
  private client: Client | undefined = undefined
  private stopped = false

  constructor(private readonly databaseUrl: string) {}

  async start(): Promise<void> {
    const client = new Client({ connectionString: this.databaseUrl })
    await client.connect()
    this.client = client

    client.on('notification', (msg) => {
      if (msg.channel !== 'sovrium_ai_compute' || !msg.payload) return
      this.handlePayload(msg.payload).catch((error: unknown) => {
        logDebug(`[ai-compute] payload handler error: ${String(error)}`)
      })
    })

    client.on('error', () => {
    })

    await client.query('LISTEN sovrium_ai_compute')
  }

  async stop(): Promise<void> {
    this.stopped = true
    const { client } = this
    this.client = undefined
    if (client) {
      try {
        await client.query('UNLISTEN sovrium_ai_compute')
      } catch {
      }
      try {
        await client.end()
      } catch {
      }
    }
  }

  private async handlePayload(raw: string): Promise<void> {
    if (this.stopped) return

    const payload = parsePayload(raw)
    if (!payload) return

    const request = buildChatRequest(payload)
    if (!request) return

    const program = Effect.gen(function* () {
      const ai = yield* AiService
      return yield* ai.chat(request)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(AiLive), Effect.either))
    if (result._tag === 'Left') {
      logDebug(`[ai-compute] AiService.chat failed: ${result.left.message}`)
    }
  }
}

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

interface ChatRequest {
  readonly messages: readonly ChatMessage[]
  readonly model?: string
  readonly temperature?: number
  readonly maxTokens?: number
}

function buildChatRequest(payload: AiComputePayload): ChatRequest | undefined {
  switch (payload.kind) {
    case 'summary':
      return buildSummaryRequest(payload)
    case 'translate':
      return buildTranslateRequest(payload)
    case 'extract':
      return buildExtractRequest(payload)
    case 'sentiment':
      return buildSentimentRequest(payload)
    case 'generate':
      return buildGenerateRequest(payload)
    case 'categorize':
    case undefined:
      return buildCategorizeRequest(payload)
  }
}

function buildCategorizeRequest(payload: AiComputePayload): ChatRequest | undefined {
  const messages = buildCategorizeMessages(payload)
  if (!messages) return undefined
  const model = payload.model ?? undefined
  return { messages, temperature: 0, ...(model !== undefined ? { model } : {}) }
}

function buildSummaryRequest(payload: AiComputePayload): ChatRequest {
  const messages = buildSummaryMessages(payload)
  const model = payload.model ?? undefined
  const temperature = payload.temperature ?? undefined
  const maxTokens = payload.maxTokens ?? undefined
  return {
    messages,
    ...(model !== undefined ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

function buildCategorizeMessages(payload: AiComputePayload): readonly ChatMessage[] | undefined {
  const { categories } = payload
  if (!categories || categories.length === 0) return undefined

  const systemPrompt = [
    'You are a classification assistant. Given source content, choose exactly',
    `one category from this list: [${categories.join(', ')}].`,
    'Respond with only the chosen category name, nothing else.',
  ].join(' ')

  const userMessage = [
    `Source content: ${payload.source}`,
    `Categories: [${categories.join(', ')}]`,
    `Chosen category: ${payload.value ?? ''}`,
  ].join('\n')

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
}

function buildSummaryMessages(payload: AiComputePayload): readonly ChatMessage[] {
  const basePrompt = payload.prompt?.trim() || 'Summarize the following content concisely'
  const lengthHint =
    typeof payload.maxLength === 'number' && payload.maxLength > 0
      ? ` Keep the summary under ${payload.maxLength} characters.`
      : ''
  const systemPrompt = `${basePrompt}.${lengthHint} Respond with only the summary text, nothing else.`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Source content: ${payload.source}` },
  ]
}

function buildTranslateRequest(payload: AiComputePayload): ChatRequest {
  const messages = buildTranslateMessages(payload)
  const model = payload.model ?? undefined
  const temperature = payload.temperature ?? undefined
  const maxTokens = payload.maxTokens ?? undefined
  return {
    messages,
    ...(model !== undefined ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

const LANGUAGE_NAMES: Readonly<Record<string, string>> = {
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  en: 'English',
}

const languageName = (code: string): string =>
  LANGUAGE_NAMES[code] ?? LANGUAGE_NAMES[code.split('-')[0] ?? code] ?? code

function buildTranslateMessages(payload: AiComputePayload): readonly ChatMessage[] {
  const target = payload.targetLanguage ?? 'en'
  const customSystem = payload.systemPrompt?.trim() ?? ''
  const base =
    customSystem ||
    `Translate the following text into ${languageName(target)}. Respond with only the translation, nothing else.`
  const customPrompt = payload.prompt?.trim() ?? ''
  const styleHint = customPrompt ? ` ${customPrompt}` : ''
  const systemPrompt = `${base}${styleHint}`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: payload.source },
  ]
}

function buildExtractRequest(payload: AiComputePayload): ChatRequest {
  const messages = buildExtractMessages(payload)
  const model = payload.model ?? undefined
  const temperature = payload.temperature ?? undefined
  const maxTokens = payload.maxTokens ?? undefined
  return {
    messages,
    ...(model !== undefined ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

function buildExtractMessages(payload: AiComputePayload): readonly ChatMessage[] {
  const schemaText = payload.schema?.trim() ?? ''
  const customSystem = payload.systemPrompt?.trim() ?? ''
  const base =
    customSystem ||
    [
      'You are a structured-data extraction assistant.',
      'Extract the requested fields from the text and respond with ONLY a JSON object',
      'matching this JSON Schema:',
      schemaText || '{}',
      'Use null for fields that cannot be determined. Do not include any prose.',
    ].join(' ')
  const customPrompt = payload.prompt?.trim() ?? ''
  const guidanceHint = customPrompt ? ` ${customPrompt}` : ''
  const systemPrompt = `${base}${guidanceHint}`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: payload.source },
  ]
}

function buildSentimentRequest(payload: AiComputePayload): ChatRequest {
  const messages = buildSentimentMessages(payload)
  const model = payload.model ?? undefined
  const temperature = payload.temperature ?? 0
  const maxTokens = payload.maxTokens ?? undefined
  return {
    messages,
    ...(model !== undefined ? { model } : {}),
    temperature,
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

function buildSentimentMessages(payload: AiComputePayload): readonly ChatMessage[] {
  const customSystem = payload.systemPrompt?.trim() ?? ''
  const base =
    customSystem ||
    [
      'You are a sentiment analysis assistant.',
      'Analyze the sentiment of the following text and respond with ONLY a JSON object',
      'of the form { "label": <one of "positive" | "negative" | "neutral" | "mixed">,',
      '"score": <float between 0.0 and 1.0 representing confidence>,',
      '"explanation": <short string justifying the classification> }.',
      'Do not include any prose outside the JSON object.',
    ].join(' ')
  const customPrompt = payload.prompt?.trim() ?? ''
  const focusHint = customPrompt ? ` ${customPrompt}` : ''
  const systemPrompt = `${base}${focusHint}`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: payload.source },
  ]
}

function buildGenerateRequest(payload: AiComputePayload): ChatRequest {
  const messages = buildGenerateMessages(payload)
  const model = payload.model ?? undefined
  const temperature = payload.temperature ?? undefined
  const maxTokens = payload.maxTokens ?? undefined
  return {
    messages,
    ...(model !== undefined ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

function buildGenerateMessages(payload: AiComputePayload): readonly ChatMessage[] {
  const customSystem = payload.systemPrompt?.trim() ?? ''
  const systemPrompt =
    customSystem ||
    'Generate the requested content. Respond with only the generated text, nothing else.'
  const userMessage = payload.prompt?.trim() || payload.source

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
}

const parsePayload = (raw: string): AiComputePayload | undefined => {
  try {
    return JSON.parse(raw) as AiComputePayload
  } catch {
    return undefined
  }
}
