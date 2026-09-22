/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  isKnownModelForProvider,
  providerSkipsModelValidation,
  type SupportedAiProvider,
} from './ai-providers'

/** A model override declared on an agent (only the bits relevant to warnings). */
export interface AgentModelOverride {
  readonly name: string
  readonly model?: string | undefined
}

const formatUnknownModelWarning = (provider: SupportedAiProvider, model: string): string =>
  `AI model "${model}" is not a known model for the "${provider}" provider — ` +
  `it may be a typo or a model from a different provider. The platform will still attempt to use it.`

const formatAgentModelWarning = (
  provider: SupportedAiProvider,
  agentName: string,
  model: string
): string =>
  `Agent "${agentName}" declares model "${model}", which is not a known model for the ` +
  `"${provider}" provider — it may be a typo. The platform will still attempt to use it.`

/**
 * Compute non-fatal startup warnings about model identifiers given the
 * configured provider, the default `AI_MODEL` (if any), and any agent
 * `model` overrides.
 *
 * Providers with open-ended model catalogues (Ollama, OpenAI-compatible)
 * always yield an empty list — the platform cannot know which models a given
 * deployment has installed.
 */
export const computeAiModelWarnings = (
  provider: SupportedAiProvider,
  defaultModel: string | undefined,
  agents: ReadonlyArray<AgentModelOverride>
): ReadonlyArray<string> => {
  if (providerSkipsModelValidation(provider)) return []

  const defaultModelWarning =
    defaultModel !== undefined &&
    defaultModel.trim() !== '' &&
    !isKnownModelForProvider(provider, defaultModel.trim())
      ? [formatUnknownModelWarning(provider, defaultModel.trim())]
      : []

  const agentWarnings = agents
    .filter(
      (agent) =>
        agent.model !== undefined &&
        agent.model.trim() !== '' &&
        !isKnownModelForProvider(provider, agent.model.trim())
    )
    .map((agent) => formatAgentModelWarning(provider, agent.name, (agent.model as string).trim()))

  return [...defaultModelWarning, ...agentWarnings]
}
