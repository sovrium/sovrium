/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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

const AI_PROVIDER_ALIASES: Readonly<Record<string, SupportedAiProvider>> = {
  gemini: 'google',
}

export const isSupportedAiProvider = (value: string): boolean =>
  (SUPPORTED_AI_PROVIDERS as readonly string[]).includes(value) || value in AI_PROVIDER_ALIASES

export const resolveAiProvider = (value: string): SupportedAiProvider | undefined => {
  if ((SUPPORTED_AI_PROVIDERS as readonly string[]).includes(value)) {
    return value as SupportedAiProvider
  }
  return AI_PROVIDER_ALIASES[value]
}

const PROVIDERS_WITHOUT_KNOWN_MODEL_CATALOGUE: ReadonlySet<SupportedAiProvider> = new Set([
  'ollama',
  'openai-compatible',
])

export const providerSkipsModelValidation = (provider: SupportedAiProvider): boolean =>
  PROVIDERS_WITHOUT_KNOWN_MODEL_CATALOGUE.has(provider)

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

export const isKnownModelForProvider = (provider: SupportedAiProvider, model: string): boolean => {
  if (providerSkipsModelValidation(provider)) return true
  return KNOWN_MODELS_BY_PROVIDER[provider].includes(model)
}

const DEFAULT_AI_MODELS: Readonly<Record<SupportedAiProvider, string | undefined>> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-4o',
  mistral: 'mistral-large-latest',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.1',
  'openai-compatible': undefined,
}

export const defaultModelForProvider = (provider: SupportedAiProvider): string | undefined =>
  DEFAULT_AI_MODELS[provider]

const PROVIDERS_REQUIRING_API_KEY: ReadonlySet<SupportedAiProvider> = new Set([
  'anthropic',
  'openai',
  'mistral',
  'google',
  'openai-compatible',
])

export const providerRequiresApiKey = (provider: SupportedAiProvider): boolean =>
  PROVIDERS_REQUIRING_API_KEY.has(provider)

const PROVIDERS_REQUIRING_BASE_URL: ReadonlySet<SupportedAiProvider> = new Set([
  'ollama',
  'openai-compatible',
])

export const providerRequiresBaseUrl = (provider: SupportedAiProvider): boolean =>
  PROVIDERS_REQUIRING_BASE_URL.has(provider)

const PROVIDER_BASE_URL_ALIASES: Readonly<Record<SupportedAiProvider, string | undefined>> = {
  anthropic: undefined,
  openai: undefined,
  mistral: undefined,
  google: undefined,
  ollama: 'OLLAMA_BASE_URL',
  'openai-compatible': undefined,
}

export const baseUrlAliasEnvVar = (provider: SupportedAiProvider): string | undefined =>
  PROVIDER_BASE_URL_ALIASES[provider]

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

const PROVIDER_API_KEY_ALIASES: Readonly<Record<SupportedAiProvider, string | undefined>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  google: 'GOOGLE_API_KEY',
  ollama: undefined,
  'openai-compatible': undefined,
}

export const apiKeyAliasEnvVar = (provider: SupportedAiProvider): string | undefined =>
  PROVIDER_API_KEY_ALIASES[provider]

const PROVIDER_DISPLAY_NAMES: Readonly<Record<SupportedAiProvider, string>> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  mistral: 'Mistral',
  google: 'Google Gemini',
  ollama: 'Ollama',
  'openai-compatible': 'OpenAI-compatible',
}

export const providerDisplayName = (provider: SupportedAiProvider): string =>
  PROVIDER_DISPLAY_NAMES[provider]

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
