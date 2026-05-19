/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { validateModelString } from '@/domain/models/env/ai-model-string'
import {
  SUPPORTED_AI_PROVIDERS,
  apiKeyAliasEnvVar,
  baseUrlAliasEnvVar,
  defaultModelForProvider,
  isSupportedAiProvider,
  providerDisplayName,
  providerRequiresApiKey,
  providerRequiresBaseUrl,
  resolveApiKey,
  resolveAiProvider,
  resolveBaseUrl,
} from '@/domain/models/env/ai-providers'
import type { App } from '@/domain/models/app'

const hasAiFields = (app: Readonly<App>): boolean =>
  app.tables?.some((table) =>
    table.fields.some((field) => typeof field.type === 'string' && field.type.startsWith('ai-'))
  ) ?? false

const hasAgents = (app: Readonly<App>): boolean => (app.agents?.length ?? 0) > 0

const checkProviderConsistency = (
  app: Readonly<App>,
  provider: string | undefined
): string | undefined => {
  const supportedList = SUPPORTED_AI_PROVIDERS.join(', ')

  if (provider !== undefined && provider !== '' && !isSupportedAiProvider(provider)) {
    return `Unknown AI_PROVIDER "${provider}". Supported providers: ${supportedList}.`
  }

  const aiDisabled = provider === undefined || provider === ''
  if (aiDisabled && hasAiFields(app)) {
    return `AI-computed fields require the AI_PROVIDER environment variable to be set. Set AI_PROVIDER to one of: ${supportedList}.`
  }
  if (aiDisabled && hasAgents(app)) {
    return `AI agents require the AI_PROVIDER environment variable to be set. Set AI_PROVIDER to one of: ${supportedList}.`
  }
  return undefined
}

const checkModelStringFormat = (rawModel: string | undefined): string | undefined => {
  if (rawModel === undefined) return undefined
  const result = validateModelString('AI_MODEL', rawModel)
  return result.ok ? undefined : result.message
}

const checkTemperatureRange = (rawTemperature: string | undefined): string | undefined => {
  if (rawTemperature === undefined || rawTemperature.trim() === '') return undefined
  const value = Number(rawTemperature)
  if (Number.isNaN(value)) {
    return `AI_TEMPERATURE must be a number between 0 and 1 (got "${rawTemperature}").`
  }
  if (value < 0 || value > 1) {
    return `AI_TEMPERATURE must be a number between 0 and 1 (got "${rawTemperature}").`
  }
  return undefined
}

const checkMaxTokensRange = (rawMaxTokens: string | undefined): string | undefined => {
  if (rawMaxTokens === undefined || rawMaxTokens.trim() === '') return undefined
  const value = Number(rawMaxTokens)
  if (!Number.isInteger(value) || value <= 0) {
    return `AI_MAX_TOKENS must be a positive integer (got "${rawMaxTokens}").`
  }
  return undefined
}

const checkApiKeyPresence = (
  provider: string | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  if (provider === undefined || provider === '') return undefined
  const canonical = resolveAiProvider(provider)
  if (canonical === undefined || !providerRequiresApiKey(canonical)) return undefined
  if (resolveApiKey(canonical, processEnv) !== undefined) return undefined
  const alias = apiKeyAliasEnvVar(canonical)
  const accepted = alias === undefined ? '`AI_API_KEY`' : `\`AI_API_KEY\` or \`${alias}\``
  return `AI_API_KEY is required for the ${providerDisplayName(canonical)} provider. Set ${accepted}.`
}

const checkBaseUrlPresence = (
  provider: string | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  if (provider === undefined || provider === '') return undefined
  const canonical = resolveAiProvider(provider)
  if (canonical === undefined || !providerRequiresBaseUrl(canonical)) return undefined
  if (resolveBaseUrl(canonical, processEnv) !== undefined) return undefined
  const alias = baseUrlAliasEnvVar(canonical)
  const accepted = alias === undefined ? '`AI_BASE_URL`' : `\`AI_BASE_URL\` or \`${alias}\``
  return `AI_BASE_URL is required for the ${providerDisplayName(canonical)} provider. Set ${accepted}.`
}

const checkModelPresence = (
  provider: string | undefined,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  if (provider === undefined || provider === '') return undefined
  const canonical = resolveAiProvider(provider)
  if (canonical === undefined) return undefined
  if (defaultModelForProvider(canonical) !== undefined) return undefined
  if ((processEnv['AI_MODEL']?.trim() ?? '') !== '') return undefined
  return `AI_MODEL is required for the ${providerDisplayName(canonical)} provider — it has no default model. Set \`AI_MODEL\` to the model identifier exposed by your ${canonical} endpoint.`
}

export const validateAiConfiguration = (
  app: Readonly<App>,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, AppValidationError> => {
  const provider = processEnv['AI_PROVIDER']?.trim()
  const message =
    checkProviderConsistency(app, provider) ??
    checkApiKeyPresence(provider, processEnv) ??
    checkBaseUrlPresence(provider, processEnv) ??
    checkModelPresence(provider, processEnv) ??
    checkModelStringFormat(processEnv['AI_MODEL']) ??
    checkTemperatureRange(processEnv['AI_TEMPERATURE']) ??
    checkMaxTokensRange(processEnv['AI_MAX_TOKENS'])
  return message === undefined ? Effect.void : Effect.fail(new AppValidationError(message))
}
