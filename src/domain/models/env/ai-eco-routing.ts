/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveAiProvider, type SupportedAiProvider } from './ai-providers'

/**
 * Provider-routing precedence controlled by the `ECO_AI_PROVIDER_PRECEDENCE`
 * env var (see `docs/architecture/patterns/ecoconception.md`, standing rule R3).
 *
 * - `local-first` (default): prefer a local provider (Ollama) when reachable,
 *   fall back to the configured cloud provider (`AI_PROVIDER`) otherwise.
 * - `cloud-first`: use the configured cloud provider, falling back to a
 *   reachable local provider only if no cloud provider is configured.
 * - `local-only`: use a local provider exclusively; the runtime refuses to
 *   start when no reachable Ollama instance is configured.
 *
 * Frugal-by-default: operators opt *out* of `local-first`, never in.
 */
export type AiProviderPrecedence = 'local-first' | 'cloud-first' | 'local-only'

const AI_PROVIDER_PRECEDENCES: readonly AiProviderPrecedence[] = [
  'local-first',
  'cloud-first',
  'local-only',
]

/** Default precedence when `ECO_AI_PROVIDER_PRECEDENCE` is unset (eco-aligned). */
export const DEFAULT_AI_PROVIDER_PRECEDENCE: AiProviderPrecedence = 'local-first'

/**
 * Resolve `ECO_AI_PROVIDER_PRECEDENCE` from a snapshot of env vars. An unset,
 * empty, or unrecognised value resolves to the eco-aligned default
 * (`local-first`) — operators opt out, they never opt in.
 */
export const parseAiProviderPrecedence = (
  processEnv: Readonly<Record<string, string | undefined>>
): AiProviderPrecedence => {
  const raw = processEnv['ECO_AI_PROVIDER_PRECEDENCE']?.trim()
  return raw !== undefined && (AI_PROVIDER_PRECEDENCES as readonly string[]).includes(raw)
    ? (raw as AiProviderPrecedence)
    : DEFAULT_AI_PROVIDER_PRECEDENCE
}

/**
 * Resolve the Ollama base URL from env: the explicit `OLLAMA_BASE_URL` alias
 * takes precedence, falling back to `AI_BASE_URL` when `AI_PROVIDER` is itself
 * `ollama`. Returns `undefined` when no local-provider endpoint is configured.
 */
export const resolveOllamaBaseUrl = (
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const explicit = processEnv['OLLAMA_BASE_URL']?.trim()
  if (explicit) return explicit
  const provider = processEnv['AI_PROVIDER']?.trim()
  if (provider && resolveAiProvider(provider) === 'ollama') {
    return processEnv['AI_BASE_URL']?.trim() || undefined
  }
  return undefined
}

/**
 * Canonical cloud provider declared via `AI_PROVIDER`, or `undefined` when
 * `AI_PROVIDER` is unset / unrecognised / itself `ollama` (a local provider,
 * not a cloud fallback target).
 */
const resolveCloudProvider = (
  processEnv: Readonly<Record<string, string | undefined>>
): SupportedAiProvider | undefined => {
  const raw = processEnv['AI_PROVIDER']?.trim()
  if (!raw) return undefined
  const canonical = resolveAiProvider(raw)
  return canonical !== undefined && canonical !== 'ollama' ? canonical : undefined
}

/**
 * The eco-routing decision surfaced on `/api/health` (`body.ai`): which
 * precedence is active, which provider AI calls are actually routed to, whether
 * the local Ollama probe succeeded, the declared `AI_PROVIDER`, and (when a
 * fall-back occurred) the operator-facing reason.
 */
export interface AiEcoRouting {
  /** Active `ECO_AI_PROVIDER_PRECEDENCE` value. */
  readonly precedence: AiProviderPrecedence
  /** Canonical provider AI calls are routed to, or `undefined` when AI is disabled. */
  readonly resolvedProvider: SupportedAiProvider | undefined
  /** Result of the Ollama reachability probe (`false` when no Ollama endpoint configured). */
  readonly ollamaReachable: boolean
  /** Raw `AI_PROVIDER` value, or `undefined` when unset. */
  readonly configured: string | undefined
  /** Why the resolver fell back to a non-preferred provider (set only on fall-back). */
  readonly fallbackReason?: string
}

/** Shared inputs the per-precedence resolvers branch on. */
interface RoutingInputs {
  readonly precedence: AiProviderPrecedence
  readonly configured: string | undefined
  readonly ollamaConfigured: boolean
  readonly ollamaUsable: boolean
  readonly cloudProvider: SupportedAiProvider | undefined
}

const baseRouting = (inputs: RoutingInputs): Omit<AiEcoRouting, 'resolvedProvider'> => ({
  precedence: inputs.precedence,
  ollamaReachable: inputs.ollamaUsable,
  configured: inputs.configured,
})

/** `cloud-first`: the configured cloud provider wins; a reachable Ollama is
 * used only when no cloud provider is configured. */
const resolveCloudFirst = (inputs: RoutingInputs): AiEcoRouting => {
  const base = baseRouting(inputs)
  if (inputs.cloudProvider !== undefined) return { ...base, resolvedProvider: inputs.cloudProvider }
  return { ...base, resolvedProvider: inputs.ollamaUsable ? 'ollama' : undefined }
}

/** `local-first` (default): a reachable Ollama wins; otherwise fall back to the
 * configured cloud provider, flagging the fall-back only when Ollama was
 * actually configured (and merely unreachable), not when it was never set. */
const resolveLocalFirst = (inputs: RoutingInputs): AiEcoRouting => {
  const base = baseRouting(inputs)
  if (inputs.ollamaUsable) return { ...base, resolvedProvider: 'ollama' }
  if (inputs.cloudProvider !== undefined) {
    return {
      ...base,
      resolvedProvider: inputs.cloudProvider,
      ...(inputs.ollamaConfigured
        ? { fallbackReason: `Ollama unreachable; falling back to ${inputs.cloudProvider}.` }
        : {}),
    }
  }
  return { ...base, resolvedProvider: inputs.ollamaConfigured ? 'ollama' : undefined }
}

/**
 * Apply the `ECO_AI_PROVIDER_PRECEDENCE` routing rules given a snapshot of env
 * vars and the (already-performed) Ollama reachability result. Pure: callers
 * own the async probe and feed the boolean in.
 */
export const resolveAiEcoRouting = (
  processEnv: Readonly<Record<string, string | undefined>>,
  ollamaReachable: boolean
): AiEcoRouting => {
  const precedence = parseAiProviderPrecedence(processEnv)
  const ollamaConfigured = resolveOllamaBaseUrl(processEnv) !== undefined
  const inputs: RoutingInputs = {
    precedence,
    configured: processEnv['AI_PROVIDER']?.trim() || undefined,
    ollamaConfigured,
    ollamaUsable: ollamaConfigured && ollamaReachable,
    cloudProvider: resolveCloudProvider(processEnv),
  }
  if (precedence === 'cloud-first') return resolveCloudFirst(inputs)
  if (precedence === 'local-only') {
    return { ...baseRouting(inputs), resolvedProvider: inputs.ollamaUsable ? 'ollama' : undefined }
  }
  return resolveLocalFirst(inputs)
}
