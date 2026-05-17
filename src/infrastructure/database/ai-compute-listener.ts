/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements */

import { Effect } from 'effect'
import { Client } from 'pg'
import { AiService } from '@/application/ports/services/ai-service'
import { AiLive } from '@/infrastructure/ai/layer'
import { logDebug } from '@/infrastructure/logging/logger'

/**
 * Payload emitted by the ai-categorize trigger via pg_notify.
 *
 * The optional `kind` discriminator distinguishes categorize payloads
 * (default — `kind` is absent or `'categorize'`) from summary payloads
 * (`kind === 'summary'`). Categorize-shaped fields (`categories`) are
 * required for the categorize path; summary-shaped fields
 * (`prompt`/`model`/`temperature`/`maxLength`) are optional metadata for
 * the summary path.
 */
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
  /** Serialised JSON Schema describing the structure of extracted data (ai-extract). */
  readonly schema?: string
}

/**
 * AI Compute Listener
 *
 * Subscribes to the PostgreSQL `sovrium_ai_compute` channel and forwards each
 * notification to the configured AI provider for logging / observability.
 *
 * Design:
 * - PostgreSQL BEFORE INSERT/UPDATE triggers synchronously compute the field
 *   value (see {@link generateAiCategorizeTriggers}) so the row is persisted
 *   with a valid value in the same transaction as the insert.
 * - After the trigger fires, pg_notify emits an event carrying the resolved
 *   value, source content, and category list.
 * - This listener receives that event and calls the AI provider via the
 *   `AiService` port (P0-2: was a direct `fetch()` against
 *   `${AI_BASE_URL}/chat/completions` before Spec 4). The AI response is
 *   currently used only for audit / logging — the deterministic trigger
 *   value is authoritative.
 *
 * PostgreSQL cannot make outbound HTTP calls from PL/pgSQL, so splitting the
 * work keeps the INSERT fully synchronous while still exercising the AI
 * provider for each compute event. This mirrors the real production pipeline
 * where an async worker would read a queue populated by the trigger.
 *
 * Env-var reading (`AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`)
 * is now centralised in `AiServiceLive`; the listener no longer reads env
 * vars directly. Callers decide whether to instantiate the listener at all
 * by checking schema features (e.g. presence of `ai-categorize` fields) and
 * by inspecting `AiService.isConfigured()` after building the service.
 */
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
      // Intentional fire-and-forget: call AI for observability only.
      this.handlePayload(msg.payload).catch((error: unknown) => {
        // Swallow errors — this listener is observational and must not crash
        // the server on transient AI provider failures.
        logDebug(`[ai-compute] payload handler error: ${String(error)}`)
      })
    })

    client.on('error', () => {
      // Connection errors are recoverable on the next restart; silently ignore
      // so the server does not crash while tests tear down.
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
        // Best-effort cleanup
      }
      try {
        await client.end()
      } catch {
        // Best-effort cleanup
      }
    }
  }

  private async handlePayload(raw: string): Promise<void> {
    if (this.stopped) return

    const payload = parsePayload(raw)
    if (!payload) return

    const request = buildChatRequest(payload)
    if (!request) return

    // Build an Effect program that resolves `AiService` from the context and
    // delegates the chat-completion call to it. Errors from the port surface
    // on the typed error channel; we map them back to a plain rejection so
    // `start()`'s `.catch()` sink can swallow them (this listener is
    // observational and must never crash the server).
    const program = Effect.gen(function* () {
      const ai = yield* AiService
      return yield* ai.chat(request)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(AiLive), Effect.either))
    if (result._tag === 'Left') {
      // Surface as a debug log so spec failures during the migration are
      // diagnosable, but never rethrow — keeps the observational contract.
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

/**
 * Dispatch a payload to the right per-`kind` builder. New AI compute field
 * types (`ai-tag`, `ai-extract`, `ai-sentiment`, ...) plug in here: add a
 * new `kind` literal to `AiComputePayload`, add a sibling `buildXxxRequest`
 * function, and register it in the switch.
 *
 * Returns `undefined` when the payload is unusable (e.g. categorize without
 * categories) so the caller can short-circuit without invoking the AI
 * provider.
 *
 * The categorize path is the legacy default (`kind` absent → categorize) so
 * any pre-existing categorize NOTIFY messages emitted by older trigger
 * versions still work after a rolling restart.
 */
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

/**
 * Build the chat request for a categorize payload. Forces `temperature: 0`
 * (deterministic class selection) and returns `undefined` if the payload is
 * missing the required `categories` array (defensive — categorize triggers
 * always emit it).
 */
function buildCategorizeRequest(payload: AiComputePayload): ChatRequest | undefined {
  const messages = buildCategorizeMessages(payload)
  if (!messages) return undefined
  return { messages, temperature: 0 }
}

/**
 * Build the chat request for a summary payload. `model` / `temperature` are
 * passed through from the per-field schema overrides (NULL → omit).
 */
function buildSummaryRequest(payload: AiComputePayload): ChatRequest {
  const messages = buildSummaryMessages(payload)
  const model = payload.model ?? undefined
  const temperature = payload.temperature ?? undefined
  return {
    messages,
    ...(model !== undefined ? { model } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
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

/**
 * Build the system + user messages for a summary payload. The system prompt
 * either uses the field's configured `prompt` (when set in schema) or a
 * conservative default. `maxLength`, when present, is surfaced to the model
 * as a soft instruction — the canonical truncation happens server-side in
 * the trigger (column already holds a capped deterministic placeholder).
 */
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

/**
 * Build the chat request for a translate payload. `model` / `temperature` /
 * `maxTokens` are passed through from the per-field schema overrides
 * (NULL → omit).
 */
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

/**
 * Minimal ISO 639-1 (+ region) → human-readable language name map for the
 * translation system prompt. Falls back to the raw code when unmapped — the
 * model still understands BCP-47-style codes.
 */
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

/**
 * Build the system + user messages for a translate payload. The system prompt
 * instructs the model to translate the source text into the target language.
 * A custom `systemPrompt` (when set) replaces the default base; a custom
 * `prompt` (when set) is appended as an extra style instruction.
 */
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

/**
 * Build the chat request for an extract payload. `model` / `temperature` /
 * `maxTokens` are passed through from the per-field schema overrides
 * (NULL → omit).
 */
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

/**
 * Build the system + user messages for an extract payload. The system prompt
 * instructs the model to return a single JSON object matching the field's
 * JSON Schema. A custom `systemPrompt` (when set) replaces the default base;
 * a custom `prompt` (when set) is appended as an extra guidance instruction.
 */
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

/**
 * Build the chat request for a sentiment payload. Forces `temperature: 0`
 * (deterministic classification) unless the field overrides it; `model` /
 * `maxTokens` are passed through from the per-field schema overrides
 * (NULL → omit).
 */
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

/**
 * Build the system + user messages for a sentiment payload. The system prompt
 * instructs the model to return a single JSON object with `label`
 * (positive/negative/neutral/mixed), `score` (0.0–1.0 confidence), and
 * `explanation`. A custom `systemPrompt` (when set) replaces the default base;
 * a custom `prompt` (when set) is appended as an extra analysis-focus hint.
 */
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

/**
 * Build the chat request for a generate payload. `model` / `temperature` /
 * `maxTokens` are passed through from the per-field schema overrides
 * (NULL → omit).
 */
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

/**
 * Build the system + user messages for a generate payload. The user message
 * is the already-interpolated prompt template (`{{fieldName}}` resolved to the
 * record's column values by the trigger). A custom `systemPrompt` (when set)
 * sets the AI persona; otherwise a conservative default instructs the model to
 * respond with only the generated text.
 */
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
