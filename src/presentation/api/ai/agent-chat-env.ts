/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Provider-aware resolution of the agent-chat backend (`{ baseUrl, apiKey }`)
 * from the environment for the one handler that still resolves it itself:
 * `POST /api/agents/:name/chat` in `ai-mcp-status.ts`.
 *
 * It was the shared source of truth for two handlers. The agent-bound
 * `/api/ai/chat` turn no longer reads it — that path resolves its provider
 * through the `AiService` port, whose own env parsing (`parseAiEnvConfig`)
 * routes Ollama to the native `/api/chat`. The two resolvers are therefore NOT
 * interchangeable and must not be re-merged on the assumption that they are:
 * this one appends `/v1` for an OpenAI-compatible caller (see
 * {@link DEFAULT_OLLAMA_BASE_URL}), and the port's resolver wants the bare host. One
 * `OLLAMA_BASE_URL` value cannot satisfy both shapes.
 *
 * The key behaviour ([internal ref] — Ollama out-of-the-box): a local Ollama needs NO
 * API key and serves the OpenAI-compatible chat API under `/v1`, so:
 *
 *  - `AI_PROVIDER` unset ⇒ default to `ollama` (frugal/local-first, matching the
 *    boot-time provider precedence).
 *  - An API key is required ONLY for key-based providers
 *    ({@link providerRequiresApiKey}); for `ollama` an absent `AI_API_KEY` is no
 *    longer an error.
 *  - The base URL resolves via {@link resolveBaseUrl} (honours the generic
 *    `AI_BASE_URL` AND the `OLLAMA_BASE_URL` alias), falling back to the local
 *    Ollama daemon's OpenAI-compatible endpoint for `ollama`.
 *
 * Returns a friendly `{ error }` only when a genuinely-required value is absent
 * (an unrecognised provider, an unresolvable base URL, or a missing key for a
 * key-based provider).
 */

import {
  providerDisplayName,
  providerRequiresApiKey,
  resolveAiProvider,
  resolveApiKey,
  resolveBaseUrl,
  type SupportedAiProvider,
} from '@/domain/models/process-env/ai/ai-providers'

/**
 * The default Ollama endpoint used when no base URL is configured. The `/v1`
 * suffix is load-bearing: the provider call appends `/chat/completions`, and
 * Ollama serves the OpenAI-compatible chat API under `/v1` (a bare
 * `:11434/chat/completions` 404s). An operator pointing `OLLAMA_BASE_URL` at a
 * remote daemon must likewise include the `/v1` segment.
 */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1'

/** The resolved chat backend, or a friendly operator-facing error string. */
export type AgentChatBackend =
  | { readonly baseUrl: string; readonly apiKey: string; readonly provider: SupportedAiProvider }
  | { readonly error: string }

/** Resolve the canonical provider, defaulting to `ollama` when unset. */
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

/**
 * Resolve the agent-chat backend from `env`. See the module doc for the
 * provider-aware rules. Pure: reads only the passed env snapshot.
 */
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

  // Ollama needs no API key; key-based providers do. An empty string for keyless
  // providers sends `Authorization: Bearer ` which a local daemon ignores.
  const apiKey = providerRequiresApiKey(provider) ? resolveApiKey(provider, env) : ''
  if (apiKey === undefined) {
    return {
      error: `AI_API_KEY is required for the ${providerDisplayName(provider)} provider. Set AI_API_KEY so agent chat can authenticate with the LLM backend.`,
    }
  }

  return { baseUrl, apiKey, provider }
}
