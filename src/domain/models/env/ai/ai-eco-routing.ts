/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveAiProvider, type SupportedAiProvider } from './ai-providers'

export type AiProviderPrecedence = 'local-first' | 'cloud-first' | 'local-only'

const AI_PROVIDER_PRECEDENCES: readonly AiProviderPrecedence[] = [
  'local-first',
  'cloud-first',
  'local-only',
]

export const DEFAULT_AI_PROVIDER_PRECEDENCE: AiProviderPrecedence = 'local-first'

export const parseAiProviderPrecedence = (
  processEnv: Readonly<Record<string, string | undefined>>
): AiProviderPrecedence => {
  const raw = processEnv['ECO_AI_PROVIDER_PRECEDENCE']?.trim()
  return raw !== undefined && (AI_PROVIDER_PRECEDENCES as readonly string[]).includes(raw)
    ? (raw as AiProviderPrecedence)
    : DEFAULT_AI_PROVIDER_PRECEDENCE
}

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

const resolveCloudProvider = (
  processEnv: Readonly<Record<string, string | undefined>>
): SupportedAiProvider | undefined => {
  const raw = processEnv['AI_PROVIDER']?.trim()
  if (!raw) return undefined
  const canonical = resolveAiProvider(raw)
  return canonical !== undefined && canonical !== 'ollama' ? canonical : undefined
}

export interface AiEcoRouting {
  readonly precedence: AiProviderPrecedence
  readonly resolvedProvider: SupportedAiProvider | undefined
  readonly ollamaReachable: boolean
  readonly configured: string | undefined
  readonly fallbackReason?: string
}

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

const resolveCloudFirst = (inputs: RoutingInputs): AiEcoRouting => {
  const base = baseRouting(inputs)
  if (inputs.cloudProvider !== undefined) return { ...base, resolvedProvider: inputs.cloudProvider }
  return { ...base, resolvedProvider: inputs.ollamaUsable ? 'ollama' : undefined }
}

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
