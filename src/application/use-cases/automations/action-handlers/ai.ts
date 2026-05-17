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

// ---------------------------------------------------------------------------
// Shared `ai:*` action plumbing
//
// `ai/generate` is the first of three AI action handlers (`ai/classify` and
// `ai/extract` follow the same pattern). The helpers below own the parts that
// every AI handler needs identically — message-list construction, per-action
// model/sampling overrides, and the `AiError` → graceful-failure mapping — so
// the later handlers compose them rather than copy-pasting the orchestration.
// Each handler keeps only its operator-specific bits: which user content it
// sends, and how it shapes `output` from the reply.
// ---------------------------------------------------------------------------

/**
 * Build the OpenAI-compatible message list for an `ai:*` step.
 *
 * The run loop already resolved `{{trigger.*}}` / `{{steps.*}}` / `$env.*`
 * in `props.prompt` and `props.systemPrompt` via `resolveTriggerInValue`, so
 * by the time a handler runs they are concrete strings. The system prompt
 * (when present and non-empty) is prepended so providers that distinguish it
 * (OpenAI, Anthropic) receive it in the canonical `system` role slot.
 *
 * `userContent` lets a handler override the user message body — `ai/classify`
 * and `ai/extract` augment `props.prompt` with the category list / extraction
 * schema before sending. When omitted the resolved `props.prompt` is used
 * verbatim (the `ai/generate` case).
 */
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

/**
 * A numeric prop that should only be forwarded when explicitly present.
 * `numberProp`'s NaN sentinel is dropped so a malformed value falls back to
 * the AiService env default rather than reaching the provider as `NaN`.
 */
const finiteProp = (props: Readonly<Record<string, unknown>>, key: string): number | undefined => {
  if (props[key] === undefined) return undefined
  const value = numberProp(props, key, Number.NaN)
  return Number.isFinite(value) ? value : undefined
}

/**
 * Per-action sampling overrides (`temperature`, `maxTokens`). Each key is
 * forwarded only when the prop is present and finite; otherwise the
 * AiService applies its `AI_TEMPERATURE` / `AI_MAX_TOKENS` env defaults.
 */
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

/**
 * Assemble a {@link ChatInput} from an `ai:*` action's resolved `props`:
 * the message list (system + user), the optional per-action `model`
 * override (which supersedes the env `AI_MODEL`), and optional sampling
 * overrides. `userContent` is threaded to {@link buildMessages}.
 */
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

// ---------------------------------------------------------------------------
// Structured AI-error envelope
//
// Every `ai:*` runtime failure (provider HTTP error, "AI not configured",
// malformed-JSON in `ai:extract`) is surfaced to the automation caller as a
// graceful `ActionOutcome` whose `output.error` carries a `{ code, message,
// retryable }` triple. The action's run-level `status` stays `'success'` so
// the synchronous webhook dispatcher returns HTTP 200 with the structured
// error in `output` — the run did not transport-fail, it produced an error
// result. Retryable failures (429 rate-limit, 5xx gateway) are flagged so
// callers (and a future automation-level retry that inspects `output.error`)
// can distinguish "try again" from "fix the config".
// ---------------------------------------------------------------------------

/** Shape surfaced as `output.error` for every graceful `ai:*` failure. */
export interface AiErrorEnvelope {
  /** Machine-readable error class (e.g. `rate_limit_exceeded`, `parse_error`). */
  readonly code: string
  /** Operator-facing diagnostic (already credential-safe; the run loop additionally redacts). */
  readonly message: string
  /** True when retrying the same request might succeed (transient provider state). */
  readonly retryable: boolean
}

/**
 * Classify an {@link AiError} from the `AiService` port into the structured
 * {@link AiErrorEnvelope} the automation runtime exposes. HTTP status codes
 * drive the mapping: 429 → rate-limit (retryable), 401/403 → authentication
 * (non-retryable), 408/504 → gateway timeout (retryable), other 5xx →
 * provider-unavailable (retryable). `AiConfigError` (no provider configured /
 * missing credentials) is non-retryable. Messages never include the
 * `Authorization` header or API key — the live adapter only ever folds the
 * provider's own response body into the message, and the run loop redacts
 * connection literals on top.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- AiError tagged classes are mutable by Data.TaggedError design
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

/**
 * Build the graceful `ActionOutcome` for an `ai:*` runtime failure: a
 * `status: 'success'` step whose `output.error` is the structured
 * {@link AiErrorEnvelope}. Keeping `status: 'success'` means a provider
 * failure inside an automation surfaces as HTTP 200 with the error in
 * `output` (per the AI runtime-error contract) rather than escalating the
 * whole run to 500. The `error` string is still set so the failed step is
 * visible in run-history / the runs API.
 */
export const aiErrorOutcome = (envelope: AiErrorEnvelope): ActionOutcome => ({
  status: 'success',
  error: `${envelope.code}: ${envelope.message}`,
  output: { error: envelope },
})

/**
 * Run an `AiService.chat` call and reduce the result to either the reply
 * (on success) or a graceful {@link ActionOutcome} carrying a structured
 * {@link AiErrorEnvelope} in `output.error`. Provider failures and the
 * "AI not configured" case (`AiProviderError` / `AiConfigError`) are
 * classified and surfaced as `status: 'success'` so the run does not 500;
 * the caller decides whether to short-circuit on `'error' in output`.
 *
 * The success branch returns the raw {@link ChatReply}; the caller decides
 * how to shape `output` (`ai/generate` → `{ text }`, `ai/classify` →
 * `{ category }`, `ai/extract` → `{ data }`, etc.).
 */
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

// ---------------------------------------------------------------------------
// `ai/generate`
// ---------------------------------------------------------------------------

/**
 * `ai/generate` handler — sends a templated prompt to the configured LLM
 * provider (via the `AiService` port, which reads `AI_PROVIDER` / `AI_BASE_URL`
 * / `AI_API_KEY` / `AI_MODEL` from env) and surfaces the generated text as
 * `output: { text }`.
 *
 * `props.model` (when set) overrides the env `AI_MODEL` for this request; the
 * captured provider request body therefore carries the per-action model.
 */
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

// ---------------------------------------------------------------------------
// `ai/classify`
// ---------------------------------------------------------------------------

/**
 * Read `props.categories` as a non-empty list of trimmed strings. Anything
 * that is not an array, or an array with no usable entries, yields `[]` so
 * the handler can presence-guard before sending a malformed prompt.
 */
const classifyCategories = (props: Readonly<Record<string, unknown>>): ReadonlyArray<string> => {
  const raw = props['categories']
  if (!Array.isArray(raw)) return []
  return raw.map((c) => String(c).trim()).filter((c) => c !== '')
}

/**
 * Build the user message body for an `ai:classify` step: the optional
 * `props.prompt` instruction (when present), the resolved `input` text, and
 * the category list — phrased so the provider returns exactly one label.
 * The run loop has already substituted `{{trigger.*}}` / `{{steps.*}}` /
 * `$env.*` in `props.input`, so `input` is a concrete string here.
 */
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

/**
 * `ai/classify` handler — categorises `props.input` into one of
 * `props.categories` using the configured LLM provider (via `AiService`),
 * surfacing the chosen label as `output: { category }`.
 *
 * The provider request carries the full category list + the interpolated
 * input so the model is constrained to the allowed set; the reply is then
 * matched (case-insensitively) back to one of the configured categories. A
 * reply that names none of them is reported as a graceful failure rather
 * than passed through as an out-of-set value.
 */
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

// ---------------------------------------------------------------------------
// `ai/extract`
// ---------------------------------------------------------------------------

/**
 * Read `props.schema` as a non-empty JSON Schema object. A missing schema, a
 * non-object value, or an object with no keys yields `undefined` so the
 * handler can presence-guard before sending a malformed extraction request.
 */
const extractSchema = (
  props: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined => {
  const raw = props['schema']
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const obj = raw as Record<string, unknown>
  return Object.keys(obj).length > 0 ? obj : undefined
}

/**
 * Build the user message body for an `ai:extract` step: the optional
 * `props.prompt` instruction, the resolved `input` text, and the stringified
 * target schema — phrased so the provider replies with only the JSON object.
 * The run loop has already substituted `{{trigger.*}}` / `{{steps.*}}` /
 * `$env.*` in `props.input`, so `input` is a concrete string here.
 */
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

/**
 * Strip an optional Markdown code fence (```json … ``` or ``` … ```) that
 * some providers wrap structured replies in, then `JSON.parse` what remains.
 * Returns the parsed value, or `undefined` if the text is not valid JSON.
 */
const parseJsonReply = (text: string): unknown => {
  const trimmed = text.trim()
  const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  try {
    return JSON.parse(fenced.trim())
  } catch {
    return undefined
  }
}

/**
 * `ai/extract` handler — sends `props.input` + a JSON Schema (`props.schema`)
 * to the configured LLM provider (via `AiService`, which forwards the schema
 * as the OpenAI `response_format` structured-output constraint) and surfaces
 * the parsed JSON object as the step `output`.
 *
 * A reply that isn't valid JSON is reported as a graceful failure rather than
 * passed through; the run loop records the failed step in run-history without
 * crashing the surrounding `Effect.gen`.
 */
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
      // Malformed-JSON reply: surface a structured `parse_error` rather than
      // a raw failure so the automation caller sees `output.error.code` and
      // no half-extracted fields leak into `output` (the run stays HTTP 200).
      return aiErrorOutcome({
        code: 'parse_error',
        message: `ai.extract: response was not a valid JSON object (got "${outcome.reply.content.trim().slice(0, 200)}")`,
        retryable: false,
      })
    }

    return { status: 'success', output: parsed as Record<string, unknown> } as const
  })
