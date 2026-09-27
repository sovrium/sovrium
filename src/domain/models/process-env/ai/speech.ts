/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result, Schema } from 'effect'
import { parseAiProviderPrecedence } from './ai-eco-routing'

/**
 * Speech-to-text environment configuration.
 *
 * Speech is its OWN endpoint, never derived from `AI_BASE_URL`: the default
 * language-model provider (Ollama) has no transcription route, so coupling the
 * two would make speech silently fail on the default install instead of being
 * honestly inert. Sovrium ships no speech model; it posts recordings to one
 * operator-run server, exactly as it posts chat to an Ollama it does not run.
 *
 * Env vars: STT_PROVIDER, STT_BASE_URL, STT_API_KEY, STT_MODEL, STT_MODEL_FAST,
 *           STT_MODEL_ACCURATE, STT_TIMEOUT_MS, STT_MAX_FILE_BYTES
 */

/** Recognised `STT_PROVIDER` values, in the order an error message lists them. */
export const SUPPORTED_SPEECH_PROVIDERS = [
  'openai-compatible',
  'whisper-cpp',
  'openai',
  'mistral',
] as const

export type SpeechProvider = (typeof SUPPORTED_SPEECH_PROVIDERS)[number]

/** Providers that send audio off the machine — refused under `local-only`. */
const CLOUD_SPEECH_PROVIDERS: ReadonlySet<SpeechProvider> = new Set(['openai', 'mistral'])

/** True when `provider` is a hosted service rather than a server the operator runs. */
export const isCloudSpeechProvider = (provider: SpeechProvider): boolean =>
  CLOUD_SPEECH_PROVIDERS.has(provider)

/** Default request deadline: an accurate-tier pass over a long recording is minutes on CPU. */
export const DEFAULT_STT_TIMEOUT_MS = 600_000

/** Default ceiling on one recording sent to the endpoint (100 MB). */
export const DEFAULT_STT_MAX_FILE_BYTES = 104_857_600

/**
 * Why a recording of `bytes` is refused under the `limit` from
 * `STT_MAX_FILE_BYTES`, or `undefined` when it fits. One sentence for every
 * place the limit is enforced — the speech service on the bytes it is handed,
 * and the `ai/transcribe` step on the size the storage catalog records before
 * it downloads anything — so an operator reads the same words either way.
 */
export const oversizedRecordingRefusal = (bytes: number, limit: number): string | undefined =>
  bytes > limit
    ? `the recording is ${String(bytes)} bytes, above the ${String(limit)}-byte limit (STT_MAX_FILE_BYTES)`
    : undefined

/** Where each provider listens when `STT_BASE_URL` is unset. */
const DEFAULT_BASE_URLS: Readonly<Record<SpeechProvider, string>> = {
  'openai-compatible': 'http://127.0.0.1:8000/v1',
  'whisper-cpp': 'http://127.0.0.1:8080',
  openai: 'https://api.openai.com/v1',
  mistral: 'https://api.mistral.ai/v1',
}

/**
 * The model a hosted provider serves when no `STT_MODEL*` is set. A local
 * server has no universal default: it serves whatever the operator loaded.
 */
const DEFAULT_MODELS: Readonly<Partial<Record<SpeechProvider, string>>> = {
  openai: 'whisper-1',
  mistral: 'voxtral-mini-latest',
}

const PositiveIntFromString = Schema.FiniteFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
)

/**
 * The longest deadline a JavaScript timer can hold (2^31 - 1 ms, about 24.8
 * days). A longer `STT_TIMEOUT_MS` would not mean "wait longer": the runtime
 * clamps an overflowing timer to 1 ms, so every transcription would time out at
 * once. It is refused at boot instead.
 */
export const MAX_TIMER_MS = 2_147_483_647

const TimerMsFromString = PositiveIntFromString.pipe(
  Schema.check(Schema.isLessThanOrEqualTo(MAX_TIMER_MS))
)

const NonEmptyString = Schema.String.pipe(Schema.check(Schema.isMinLength(1)))

/** The raw `STT_*` variables, decoded. Every key is optional: unset means inert. */
export const SpeechEnvSchema = Schema.Struct({
  provider: Schema.optional(
    Schema.Literals(SUPPORTED_SPEECH_PROVIDERS).annotate({
      description: 'Speech-to-text provider (STT_PROVIDER); unset keeps speech off',
    })
  ),
  baseUrl: Schema.optional(
    Schema.String.annotate({
      description: 'Speech endpoint base URL (STT_BASE_URL)',
      examples: ['http://127.0.0.1:8000/v1', 'http://127.0.0.1:8080'],
    }).pipe(Schema.check(Schema.isPattern(/^https?:\/\/.+/)))
  ),
  apiKey: Schema.optional(
    NonEmptyString.annotate({ description: 'Key for a cloud speech provider (STT_API_KEY)' })
  ),
  model: Schema.optional(
    NonEmptyString.annotate({ description: 'Default speech model (STT_MODEL)' })
  ),
  fastModel: Schema.optional(
    NonEmptyString.annotate({ description: 'Model for the fast tier (STT_MODEL_FAST)' })
  ),
  accurateModel: Schema.optional(
    NonEmptyString.annotate({ description: 'Model for the accurate tier (STT_MODEL_ACCURATE)' })
  ),
  timeoutMs: Schema.optional(
    TimerMsFromString.annotate({ description: 'Per-request deadline (STT_TIMEOUT_MS)' })
  ),
  maxFileBytes: Schema.optional(
    PositiveIntFromString.annotate({ description: 'Largest recording sent (STT_MAX_FILE_BYTES)' })
  ),
})

/** A configured speech endpoint, every default applied. */
export interface SpeechConfig {
  readonly provider: SpeechProvider
  readonly baseUrl: string
  readonly apiKey?: string
  readonly model?: string
  readonly fastModel?: string
  readonly accurateModel?: string
  readonly timeoutMs: number
  readonly maxFileBytes: number
}

/** The tier vocabulary shared with the `quality` prop of every speech surface. */
export type SpeechTier = 'fast' | 'accurate'

const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}

const describeInvalidEnv = (env: Readonly<Record<string, string | undefined>>): string => {
  const provider = blankToUndefined(env['STT_PROVIDER'])
  if (
    provider !== undefined &&
    !(SUPPORTED_SPEECH_PROVIDERS as readonly string[]).includes(provider)
  ) {
    return `STT_PROVIDER=${provider} is not a supported speech provider. Supported: ${SUPPORTED_SPEECH_PROVIDERS.join(', ')}.`
  }
  return 'The STT_* speech-to-text variables are invalid: STT_BASE_URL must be an http(s) URL, STT_TIMEOUT_MS must be a positive integer of at most 2147483647 (milliseconds), and STT_MAX_FILE_BYTES a positive integer.'
}

/**
 * The outcome of reading the `STT_*` variables: a configuration (`undefined`
 * when speech is off), or the operator-facing reason it is invalid.
 */
export type SpeechEnvParse =
  | { readonly ok: true; readonly config: SpeechConfig | undefined }
  | { readonly ok: false; readonly error: string }

/**
 * Read the `STT_*` variables from an env snapshot.
 *
 * Total: an invalid value is `{ ok: false }` carrying an operator-facing
 * message (startup turns it into a refused boot), an unset `STT_PROVIDER` is
 * `{ ok: true, config: undefined }` — speech is off, and nothing else is.
 */
export const parseSpeechEnv = (
  env: Readonly<Record<string, string | undefined>>
): SpeechEnvParse => {
  const decoded = Schema.decodeUnknownResult(SpeechEnvSchema)({
    provider: blankToUndefined(env['STT_PROVIDER']),
    baseUrl: blankToUndefined(env['STT_BASE_URL']),
    apiKey: blankToUndefined(env['STT_API_KEY']),
    model: blankToUndefined(env['STT_MODEL']),
    fastModel: blankToUndefined(env['STT_MODEL_FAST']),
    accurateModel: blankToUndefined(env['STT_MODEL_ACCURATE']),
    timeoutMs: blankToUndefined(env['STT_TIMEOUT_MS']),
    maxFileBytes: blankToUndefined(env['STT_MAX_FILE_BYTES']),
  })
  if (Result.isFailure(decoded)) return { ok: false, error: describeInvalidEnv(env) }
  const raw = decoded.success
  if (raw.provider === undefined) return { ok: true, config: undefined }
  return {
    ok: true,
    config: {
      provider: raw.provider,
      baseUrl: (raw.baseUrl ?? DEFAULT_BASE_URLS[raw.provider]).replace(/\/+$/, ''),
      ...(raw.apiKey !== undefined ? { apiKey: raw.apiKey } : {}),
      ...(raw.model !== undefined ? { model: raw.model } : {}),
      ...(raw.fastModel !== undefined ? { fastModel: raw.fastModel } : {}),
      ...(raw.accurateModel !== undefined ? { accurateModel: raw.accurateModel } : {}),
      timeoutMs: raw.timeoutMs ?? DEFAULT_STT_TIMEOUT_MS,
      maxFileBytes: raw.maxFileBytes ?? DEFAULT_STT_MAX_FILE_BYTES,
    },
  }
}

/**
 * The model a tier resolves to: its own variable, then `STT_MODEL`, then the
 * provider's hosted default. `undefined` means "let the server choose".
 */
export const resolveSpeechTierModel = (
  config: SpeechConfig,
  tier: SpeechTier
): string | undefined =>
  (tier === 'fast' ? config.fastModel : config.accurateModel) ??
  config.model ??
  DEFAULT_MODELS[config.provider]

/** The model one request uses: an exact override wins over the tier. */
export const resolveSpeechModel = (
  config: SpeechConfig,
  tier: SpeechTier,
  override?: string
): string | undefined => {
  const exact = blankToUndefined(override)
  return exact ?? resolveSpeechTierModel(config, tier)
}

/**
 * Why a configured speech provider may not be used under the active
 * `ECO_AI_PROVIDER_PRECEDENCE`, or `undefined` when it may. Only `local-only`
 * refuses anything: it forbids audio leaving the machine.
 */
export const speechPrecedenceRefusal = (
  config: SpeechConfig,
  env: Readonly<Record<string, string | undefined>>
): string | undefined =>
  parseAiProviderPrecedence(env) === 'local-only' && isCloudSpeechProvider(config.provider)
    ? `ECO_AI_PROVIDER_PRECEDENCE=local-only forbids a cloud speech provider, but STT_PROVIDER=${config.provider} would send recordings off this machine. Point speech-to-text at a local server (STT_PROVIDER=openai-compatible or whisper-cpp) or choose another precedence.`
    : undefined

/**
 * Why a configured speech provider cannot work without a credential, or
 * `undefined` when it can. A hosted provider (OpenAI, Mistral) authenticates
 * every request, so a missing `STT_API_KEY` would fail every transcription at
 * run time; refusing at startup names the variable while the operator is
 * still looking at the terminal. A local server needs no key.
 */
export const speechCredentialRefusal = (config: SpeechConfig): string | undefined =>
  isCloudSpeechProvider(config.provider) && config.apiKey === undefined
    ? `STT_PROVIDER=${config.provider} is a hosted speech provider and needs a key, but STT_API_KEY is empty. Set STT_API_KEY to your ${config.provider} API key, or point speech-to-text at a local server (STT_PROVIDER=openai-compatible or whisper-cpp).`
    : undefined
