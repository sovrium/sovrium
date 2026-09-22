/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Supported `AI_PROVIDER` identifiers.
 *
 * This is the canonical, operator-facing list surfaced in startup error
 * messages when `AI_PROVIDER` is set to something unrecognised. `google`
 * is the canonical name for Google's Gemini models; `gemini` is accepted
 * as a backwards-compatible alias (see {@link isSupportedAiProvider}).
 *
 * Order matters — it is the order used in the "Supported: ..." error
 * message and the order asserted by
 * `[internal ref]`.
 */
export const SUPPORTED_AI_PROVIDERS = [
  'anthropic',
  'openai',
  'mistral',
  'google',
  'ollama',
  'openai-compatible',
] as const

export type SupportedAiProvider = (typeof SUPPORTED_AI_PROVIDERS)[number]

/** Backwards-compatible aliases accepted in addition to the canonical names. */
const AI_PROVIDER_ALIASES: Readonly<Record<string, SupportedAiProvider>> = {
  gemini: 'google',
}

/**
 * True when `value` is a recognised `AI_PROVIDER` (canonical name or alias).
 */
export const isSupportedAiProvider = (value: string): boolean =>
  (SUPPORTED_AI_PROVIDERS as readonly string[]).includes(value) || value in AI_PROVIDER_ALIASES

/**
 * True when an AI provider is actually configured — i.e. `AI_PROVIDER` is set
 * (after trimming) to a recognised provider. This is the "inert vs active"
 * signal for AI agents: when no provider is chosen at all, declared
 * agents boot INERT (discoverable but not runnable) rather than crashing, and
 * agent-backed surfaces degrade gracefully (503 / an "unavailable" panel notice)
 * instead of attempting an unreachable call. An unrecognised value never reaches
 * this decision at runtime because startup validation rejects it outright
 * (`checkProviderConsistency`), but the `isSupportedAiProvider` guard keeps the
 * function honest in isolation. Reads only the passed env snapshot so it stays
 * trivially testable.
 */
export const isAiProviderConfigured = (
  processEnv: Readonly<Record<string, string | undefined>>
): boolean => {
  const raw = processEnv['AI_PROVIDER']?.trim()
  return raw !== undefined && raw !== '' && isSupportedAiProvider(raw)
}

/**
 * Resolve a raw `AI_PROVIDER` value to its canonical name, applying the
 * backwards-compatible alias map. Returns `undefined` when unrecognised.
 */
export const resolveAiProvider = (value: string): SupportedAiProvider | undefined => {
  if ((SUPPORTED_AI_PROVIDERS as readonly string[]).includes(value)) {
    return value as SupportedAiProvider
  }
  return AI_PROVIDER_ALIASES[value]
}

/**
 * Providers whose model catalogue is open-ended (locally installed Ollama
 * models, or arbitrary models behind an OpenAI-compatible endpoint). For
 * these, the platform cannot maintain a known-model list, so cross-provider
 * / unknown-model warnings are skipped entirely.
 */
const PROVIDERS_WITHOUT_KNOWN_MODEL_CATALOGUE: ReadonlySet<SupportedAiProvider> = new Set([
  'ollama',
  'openai-compatible',
])

/**
 * True when the provider's model catalogue is open-ended and unknown-model
 * validation/warnings should be skipped (Ollama, OpenAI-compatible).
 */
export const providerSkipsModelValidation = (provider: SupportedAiProvider): boolean =>
  PROVIDERS_WITHOUT_KNOWN_MODEL_CATALOGUE.has(provider)

/**
 * Curated list of well-known model identifiers per provider. Used to emit a
 * non-fatal startup warning when `AI_MODEL` (or an agent's `model` override)
 * does not match a known model for the configured provider — typically a
 * cross-provider mix-up (e.g. `gpt-4o` on `anthropic`) or a typo
 * (e.g. `claud-sonet`). The list is intentionally non-exhaustive: providers
 * with open-ended catalogues are absent (see {@link providerSkipsModelValidation}).
 */
const KNOWN_MODELS_BY_PROVIDER: Readonly<Record<SupportedAiProvider, readonly string[]>> = {
  anthropic: [
    'claude-sonnet-4-5',
    'claude-sonnet-4',
    'claude-opus-4-1',
    'claude-opus-4',
    'claude-haiku-4-5',
    'claude-3-7-sonnet',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'claude-3-opus',
  ],
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o3-mini',
  ],
  mistral: [
    'mistral-large-latest',
    'mistral-small-latest',
    'open-mistral-nemo',
    'codestral-latest',
  ],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
  ollama: [],
  'openai-compatible': [],
}

/**
 * True when `model` is a recognised model identifier for `provider`. Always
 * returns `true` for providers with open-ended catalogues so callers never
 * warn about Ollama / OpenAI-compatible models.
 */
export const isKnownModelForProvider = (provider: SupportedAiProvider, model: string): boolean => {
  if (providerSkipsModelValidation(provider)) return true
  return KNOWN_MODELS_BY_PROVIDER[provider].includes(model)
}

/**
 * Default model identifier per provider, used when `AI_MODEL` is unset. These
 * track each provider's current recommended general-purpose model. Providers
 * with open-ended catalogues (Ollama, OpenAI-compatible) still get a sensible
 * default here, but `openai-compatible` deployments are expected to set
 * `AI_MODEL` explicitly (no universal default exists for an arbitrary endpoint).
 */
const DEFAULT_AI_MODELS: Readonly<Record<SupportedAiProvider, string | undefined>> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o',
  mistral: 'mistral-large-latest',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.1',
  'openai-compatible': undefined,
}

/**
 * Resolve the effective default model for `provider` — the value surfaced as
 * the active model when the operator has not pinned one via `AI_MODEL`.
 * Returns `undefined` only for providers without a meaningful universal default
 * (currently `openai-compatible`).
 */
export const defaultModelForProvider = (provider: SupportedAiProvider): string | undefined =>
  DEFAULT_AI_MODELS[provider]

/**
 * Providers that authenticate via an API key and therefore require one to be
 * supplied (via `AI_API_KEY` or a provider-specific alias). `ollama` is the
 * only exception — it runs locally and needs no key. `openai-compatible`
 * endpoints are reached via `AI_BASE_URL` and still expect a bearer token, so
 * `AI_API_KEY` is required there too.
 */
const PROVIDERS_REQUIRING_API_KEY: ReadonlySet<SupportedAiProvider> = new Set([
  'anthropic',
  'openai',
  'mistral',
  'google',
  'openai-compatible',
])

/** True when `provider` must be configured with an API key. */
export const providerRequiresApiKey = (provider: SupportedAiProvider): boolean =>
  PROVIDERS_REQUIRING_API_KEY.has(provider)

/**
 * Providers reached via an operator-supplied endpoint URL and therefore
 * require a base URL to be configured. `ollama` runs locally and
 * `openai-compatible` points at an arbitrary endpoint — both need
 * `AI_BASE_URL` (Ollama additionally accepts the `OLLAMA_BASE_URL` alias).
 * The first-party cloud providers ship with a built-in default endpoint, so
 * they need no base URL.
 */
const PROVIDERS_REQUIRING_BASE_URL: ReadonlySet<SupportedAiProvider> = new Set([
  'ollama',
  'openai-compatible',
])

/** True when `provider` must be configured with a base URL endpoint. */
export const providerRequiresBaseUrl = (provider: SupportedAiProvider): boolean =>
  PROVIDERS_REQUIRING_BASE_URL.has(provider)

/**
 * Provider-specific base-URL environment variable aliases accepted in addition
 * to the generic `AI_BASE_URL`. Example: `OLLAMA_BASE_URL` for `ollama`.
 */
const PROVIDER_BASE_URL_ALIASES: Readonly<Record<SupportedAiProvider, string | undefined>> = {
  anthropic: undefined,
  openai: undefined,
  mistral: undefined,
  google: undefined,
  ollama: 'OLLAMA_BASE_URL',
  'openai-compatible': undefined,
}

/**
 * The provider-specific base-URL env var name for `provider` (e.g.
 * `'OLLAMA_BASE_URL'`), or `undefined` when the provider has no alias.
 */
export const baseUrlAliasEnvVar = (provider: SupportedAiProvider): string | undefined =>
  PROVIDER_BASE_URL_ALIASES[provider]

/**
 * Resolve the effective AI base URL from a snapshot of env vars for a given
 * canonical provider: `AI_BASE_URL` takes precedence, falling back to the
 * provider-specific alias (e.g. `OLLAMA_BASE_URL`). Returns `undefined` when
 * neither is present (after trimming).
 */
export const resolveBaseUrl = (
  provider: SupportedAiProvider,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const generic = processEnv['AI_BASE_URL']?.trim()
  if (generic) return generic
  const aliasVar = baseUrlAliasEnvVar(provider)
  const aliasValue = aliasVar ? processEnv[aliasVar]?.trim() : undefined
  return aliasValue || undefined
}

/**
 * Provider-specific API-key environment variable aliases accepted in addition
 * to the generic `AI_API_KEY`. Example: `ANTHROPIC_API_KEY` for `anthropic`.
 */
const PROVIDER_API_KEY_ALIASES: Readonly<Record<SupportedAiProvider, string | undefined>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  google: 'GOOGLE_API_KEY',
  ollama: undefined,
  'openai-compatible': undefined,
}

/**
 * The provider-specific API-key env var name for `provider` (e.g.
 * `'ANTHROPIC_API_KEY'`), or `undefined` when the provider has no alias.
 */
export const apiKeyAliasEnvVar = (provider: SupportedAiProvider): string | undefined =>
  PROVIDER_API_KEY_ALIASES[provider]

/**
 * Human-readable display name for a provider, used in operator-facing startup
 * error messages (e.g. "AI_API_KEY is required for the Anthropic provider").
 */
const PROVIDER_DISPLAY_NAMES: Readonly<Record<SupportedAiProvider, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  mistral: 'Mistral',
  google: 'Google Gemini',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-compatible',
}

/** Human-readable display name for `provider`. */
export const providerDisplayName = (provider: SupportedAiProvider): string =>
  PROVIDER_DISPLAY_NAMES[provider]

/**
 * Resolve the effective AI API key from a snapshot of env vars for a given
 * canonical provider: `AI_API_KEY` takes precedence, falling back to the
 * provider-specific alias (e.g. `ANTHROPIC_API_KEY`). Returns `undefined` when
 * neither is present (after trimming).
 */
export const resolveApiKey = (
  provider: SupportedAiProvider,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const generic = processEnv['AI_API_KEY']?.trim()
  if (generic) return generic
  const aliasVar = apiKeyAliasEnvVar(provider)
  const aliasValue = aliasVar ? processEnv[aliasVar]?.trim() : undefined
  return aliasValue || undefined
}
