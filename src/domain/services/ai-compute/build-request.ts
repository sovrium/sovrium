/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { AiComputeKind } from './baseline'

export interface AiComputeChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface AiComputeChatRequest {
  readonly messages: readonly AiComputeChatMessage[]
  readonly model?: string
  readonly temperature?: number
  readonly maxTokens?: number
}

export interface AiComputeRequestConfig {
  readonly prompt?: string | null
  readonly systemPrompt?: string | null
  readonly model?: string | null
  readonly temperature?: number | null
  readonly maxTokens?: number | null
  readonly maxLength?: number | null
  readonly categories?: readonly string[]
  readonly targetLanguage?: string
  readonly schema?: string
}

export interface AiComputeRequestInput {
  readonly kind: AiComputeKind
  readonly source: string
  readonly baselineValue?: string | undefined
  readonly config: AiComputeRequestConfig
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

const overrides = (
  config: AiComputeRequestConfig,
  defaults: { readonly temperature?: number } = {}
): Pick<AiComputeChatRequest, 'model' | 'temperature' | 'maxTokens'> => {
  const model = config.model ?? undefined
  const temperature = config.temperature ?? defaults.temperature
  const maxTokens = config.maxTokens ?? undefined
  return {
    ...(model !== undefined ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }
}

const buildSummaryMessages = (input: AiComputeRequestInput): readonly AiComputeChatMessage[] => {
  const { config, source } = input
  const basePrompt = config.prompt?.trim() || 'Summarize the following content concisely'
  const lengthHint =
    typeof config.maxLength === 'number' && config.maxLength > 0
      ? ` Keep the summary under ${config.maxLength} characters.`
      : ''
  const systemPrompt = `${basePrompt}.${lengthHint} Respond with only the summary text, nothing else.`
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Source content: ${source}` },
  ]
}

const buildCategorizeMessages = (
  input: AiComputeRequestInput
): readonly AiComputeChatMessage[] | undefined => {
  const { categories } = input.config
  if (!categories || categories.length === 0) return undefined
  const systemPrompt = [
    'You are a classification assistant. Given source content, choose exactly',
    `one category from this list: [${categories.join(', ')}].`,
    'Respond with only the chosen category name, nothing else.',
  ].join(' ')
  const userMessage = [
    `Source content: ${input.source}`,
    `Categories: [${categories.join(', ')}]`,
    `Chosen category: ${input.baselineValue ?? ''}`,
  ].join('\n')
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
}

const buildTranslateMessages = (input: AiComputeRequestInput): readonly AiComputeChatMessage[] => {
  const { config, source } = input
  const target = config.targetLanguage ?? 'en'
  const customSystem = config.systemPrompt?.trim() ?? ''
  const base =
    customSystem ||
    `Translate the following text into ${languageName(target)}. Respond with only the translation, nothing else.`
  const styleHint = config.prompt?.trim() ? ` ${config.prompt.trim()}` : ''
  return [
    { role: 'system', content: `${base}${styleHint}` },
    { role: 'user', content: source },
  ]
}

const buildExtractMessages = (input: AiComputeRequestInput): readonly AiComputeChatMessage[] => {
  const { config, source } = input
  const schemaText = config.schema?.trim() ?? ''
  const customSystem = config.systemPrompt?.trim() ?? ''
  const base =
    customSystem ||
    [
      'You are a structured-data extraction assistant.',
      'Extract the requested fields from the text and respond with ONLY a JSON object',
      'matching this JSON Schema:',
      schemaText || '{}',
      'Use null for fields that cannot be determined. Do not include any prose.',
    ].join(' ')
  const guidanceHint = config.prompt?.trim() ? ` ${config.prompt.trim()}` : ''
  return [
    { role: 'system', content: `${base}${guidanceHint}` },
    { role: 'user', content: source },
  ]
}

const buildSentimentMessages = (input: AiComputeRequestInput): readonly AiComputeChatMessage[] => {
  const { config, source } = input
  const customSystem = config.systemPrompt?.trim() ?? ''
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
  const focusHint = config.prompt?.trim() ? ` ${config.prompt.trim()}` : ''
  return [
    { role: 'system', content: `${base}${focusHint}` },
    { role: 'user', content: source },
  ]
}

const buildGenerateMessages = (input: AiComputeRequestInput): readonly AiComputeChatMessage[] => {
  const { config, source } = input
  const customSystem = config.systemPrompt?.trim() ?? ''
  const systemPrompt =
    customSystem ||
    'Generate the requested content. Respond with only the generated text, nothing else.'
  const userMessage = config.prompt?.trim() || source
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]
}

export const buildAiComputeChatRequest = (
  input: AiComputeRequestInput
): AiComputeChatRequest | undefined => {
  switch (input.kind) {
    case 'ai-summary':
      return { messages: buildSummaryMessages(input), ...overrides(input.config) }
    case 'ai-categorize': {
      const messages = buildCategorizeMessages(input)
      if (!messages) return undefined
      return { messages, ...overrides(input.config, { temperature: 0 }) }
    }
    case 'ai-tag': {
      const messages = buildCategorizeMessages(input)
      if (!messages) return undefined
      return { messages, ...overrides(input.config, { temperature: 0 }) }
    }
    case 'ai-translate':
      return { messages: buildTranslateMessages(input), ...overrides(input.config) }
    case 'ai-extract':
      return { messages: buildExtractMessages(input), ...overrides(input.config) }
    case 'ai-sentiment':
      return {
        messages: buildSentimentMessages(input),
        ...overrides(input.config, { temperature: 0 }),
      }
    case 'ai-generate':
      return { messages: buildGenerateMessages(input), ...overrides(input.config) }
  }
}

const kindExtras = (
  kind: AiComputeKind,
  field: Readonly<Record<string, unknown>>
): Partial<AiComputeRequestConfig> => {
  if (kind === 'ai-categorize') return { categories: field['categories'] as readonly string[] }
  if (kind === 'ai-tag') return { categories: field['tags'] as readonly string[] }
  if (kind === 'ai-translate') return { targetLanguage: field['targetLanguage'] as string }
  if (kind === 'ai-extract') return { schema: JSON.stringify(field['schema'] ?? {}) }
  return {}
}

export const fieldToRequestConfig = (
  kind: AiComputeKind,
  field: Readonly<Record<string, unknown>>
): AiComputeRequestConfig => ({
  prompt: field['prompt'] as string | undefined,
  systemPrompt: field['systemPrompt'] as string | undefined,
  model: field['model'] as string | undefined,
  temperature: field['temperature'] as number | undefined,
  maxTokens: field['maxTokens'] as number | undefined,
  maxLength: field['maxLength'] as number | undefined,
  ...kindExtras(kind, field),
})
