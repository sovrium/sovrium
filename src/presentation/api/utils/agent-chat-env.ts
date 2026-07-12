/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  providerDisplayName,
  providerRequiresApiKey,
  resolveAiProvider,
  resolveApiKey,
  resolveBaseUrl,
  type SupportedAiProvider,
} from '@/domain/models/env/ai/ai-providers'

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1'

export type AgentChatBackend =
  | { readonly baseUrl: string; readonly apiKey: string; readonly provider: SupportedAiProvider }
  | { readonly error: string }

const resolveProvider = (
  rawProvider: string | undefined
): SupportedAiProvider | { error: string } => {
  if (rawProvider === undefined || rawProvider === '') return 'ollama'
  const provider = resolveAiProvider(rawProvider)
  if (provider === undefined) {
    return {
      error: `AI_PROVIDER "${rawProvider}" is not a recognised provider. Set AI_PROVIDER to a supported value so the platform can reach the LLM backend.`,
    }
  }
  return provider
}

export const resolveAgentChatBackend = (env: NodeJS.ProcessEnv): AgentChatBackend => {
  const provider = resolveProvider(env.AI_PROVIDER?.trim())
  if (typeof provider === 'object') return provider

  const baseUrl =
    resolveBaseUrl(provider, env) ?? (provider === 'ollama' ? DEFAULT_OLLAMA_BASE_URL : undefined)
  if (baseUrl === undefined) {
    return {
      error: `AI_BASE_URL is required for the ${providerDisplayName(provider)} provider. Set AI_BASE_URL so the platform can reach the LLM backend.`,
    }
  }

  const apiKey = providerRequiresApiKey(provider) ? resolveApiKey(provider, env) : ''
  if (apiKey === undefined) {
    return {
      error: `AI_API_KEY is required for the ${providerDisplayName(provider)} provider. Set AI_API_KEY so agent chat can authenticate with the LLM backend.`,
    }
  }

  return { baseUrl, apiKey, provider }
}
