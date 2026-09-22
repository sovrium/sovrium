/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared per-kind AI chat-request builders for AI-compute refinement
 * ([internal ref] Phase 2, design §4).
 *
 * SINGLE SOURCE OF TRUTH for prompt construction. Both refinement invocation
 * paths converge here:
 *   - Postgres: the NOTIFY listener (`ai-compute-listener.ts`) parses the
 *     `pg_notify` payload and calls {@link buildAiComputeChatRequest}.
 *   - SQLite: the post-write `Effect.tap` hook builds the same normalized input
 *     from the field config and calls the same function.
 *
 * Pure functions only — no Effect, no I/O. The request shape mirrors the
 * `AiService.chat` `ChatInput` subset the worker uses (messages + the optional
 * model/temperature/maxTokens overrides).
 */

import type { AiComputeKind } from './ai-compute-baseline'

/** A single chat message (OpenAI-compatible). */
export interface AiComputeChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

/** The chat request shape consumed by the worker (subset of `ChatInput`). */
export interface AiComputeChatRequest {
  readonly messages: readonly AiComputeChatMessage[]
  readonly model?: string
  readonly temperature?: number
  readonly maxTokens?: number
}

/**
 * The per-field config the request builders read. A normalized superset of the
 * fields each AI-compute kind carries — only the keys relevant to a given kind
 * are consulted. Both the NOTIFY payload (PG) and the schema field (SQLite)
 * project onto this shape.
 */
export interface AiComputeRequestConfig {
  readonly prompt?: string | null
  readonly systemPrompt?: string | null
  readonly model?: string | null
  readonly temperature?: number | null
  readonly maxTokens?: number | null
  readonly maxLength?: number | null
  readonly categories?: readonly string[]
  readonly targetLanguage?: string
  /** Serialised JSON Schema describing the structure of extracted data (ai-extract). */
  readonly schema?: string
}

/** The normalized input the worker hands to the request builder. */
export interface AiComputeRequestInput {
  readonly kind: AiComputeKind
  /** Concatenated source content (already joined the same way as the baseline). */
  readonly source: string
  /** The deterministic baseline value (carried through for categorize context). */
  readonly baselineValue?: string | undefined
  readonly config: AiComputeRequestConfig
}

/** ISO 639-1 (+region) → human language name (mirrors the listener map). */
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

/** Spread the optional model/temperature/maxTokens overrides (NULL → omit). */
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

/**
 * Build the chat request for an AI-compute refinement. Returns `undefined` when
 * the input is unusable (e.g. categorize without a category list) so the caller
 * can short-circuit without invoking the provider.
 *
 * categorize + sentiment force `temperature: 0` (deterministic classification)
 * unless the field overrides it; the other kinds pass overrides through verbatim.
 */
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

/** The per-kind extra config keys (categories/tags/targetLanguage/schema). */
const kindExtras = (
  kind: AiComputeKind,
  field: Readonly<Record<string, unknown>>
): Partial<AiComputeRequestConfig> => {
  if (kind === 'ai-categorize') return { categories: field['categories'] as readonly string[] }
  if (kind === 'ai-tag') return { categories: field['tags'] as readonly string[] }
  if (kind === 'ai-translate') return { targetLanguage: field['targetLanguage'] as string }
  // @effect-diagnostics effect/preferSchemaOverJson:off
  if (kind === 'ai-extract') return { schema: JSON.stringify(field['schema'] ?? {}) }
  return {}
}

/**
 * Project a raw AI-compute field config (schema field on SQLite, NOTIFY payload
 * on PG) onto the shared {@link AiComputeRequestConfig}. SINGLE projection so
 * the SQLite enqueue and PG listener build identical requests. Optional keys are
 * `undefined` (omitted) when absent.
 */
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
