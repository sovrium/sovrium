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
  isSupportedAiProvider,
  providerDisplayName,
  providerRequiresApiKey,
  resolveApiKey,
  resolveAiProvider,
} from '@/domain/models/env/ai-providers'
import type { App } from '@/domain/models/app'

/**
 * True when at least one table field is an AI-computed field type
 * (`ai-summary`, `ai-categorize`, `ai-extract`, `ai-generate`,
 * `ai-sentiment`, `ai-tag`, `ai-translate`). These all share the `ai-`
 * prefix, so a prefix check is sufficient and forward-compatible with new
 * AI field types.
 */
const hasAiFields = (app: Readonly<App>): boolean =>
  app.tables?.some((table) =>
    table.fields.some((field) => typeof field.type === 'string' && field.type.startsWith('ai-'))
  ) ?? false

/** True when the app schema declares one or more AI agents. */
const hasAgents = (app: Readonly<App>): boolean => (app.agents?.length ?? 0) > 0

/**
 * Provider-consistency check: returns a failure message when `AI_PROVIDER`
 * is set to an unrecognised value, or when AI fields / agents are declared
 * while `AI_PROVIDER` is unset. Returns `undefined` when the provider config
 * is internally consistent.
 */
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

/**
 * Model-identifier format check: when `AI_MODEL` is present it must be a
 * well-formed single token (non-empty, no whitespace, <= 128 chars).
 * Returns `undefined` when absent or valid.
 */
const checkModelStringFormat = (rawModel: string | undefined): string | undefined => {
  if (rawModel === undefined) return undefined
  const result = validateModelString('AI_MODEL', rawModel)
  return result.ok ? undefined : result.message
}

/**
 * Common-parameter range check for `AI_TEMPERATURE`: when present it must
 * parse as a number in the inclusive range 0–1. Returns `undefined` when
 * absent or valid.
 */
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

/**
 * Common-parameter range check for `AI_MAX_TOKENS`: when present it must
 * parse as a positive integer. Returns `undefined` when absent or valid.
 */
const checkMaxTokensRange = (rawMaxTokens: string | undefined): string | undefined => {
  if (rawMaxTokens === undefined || rawMaxTokens.trim() === '') return undefined
  const value = Number(rawMaxTokens)
  if (!Number.isInteger(value) || value <= 0) {
    return `AI_MAX_TOKENS must be a positive integer (got "${rawMaxTokens}").`
  }
  return undefined
}

/**
 * API-key presence check: providers that authenticate via an API key
 * (`anthropic` / `openai` / `mistral` / `google` / `openai-compatible`) must
 * have one supplied via `AI_API_KEY` or the provider-specific alias (e.g.
 * `ANTHROPIC_API_KEY`). Returns `undefined` when the provider needs no key
 * (Ollama) or a key is present. The error names both the provider and the
 * accepted env var(s) so operators can self-serve the fix.
 */
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

/**
 * Validate that the AI configuration in env vars is consistent with the
 * app schema. Surfaces operator-facing errors at startup so AI misconfig
 * never silently no-ops or crashes mid-request.
 *
 * Pure function: takes the validated app and a snapshot of `process.env`
 * so it stays trivially testable without touching the global.
 */
export const validateAiConfiguration = (
  app: Readonly<App>,
  processEnv: Readonly<Record<string, string | undefined>>
): Effect.Effect<void, AppValidationError> => {
  const provider = processEnv['AI_PROVIDER']?.trim()
  const message =
    checkProviderConsistency(app, provider) ??
    checkApiKeyPresence(provider, processEnv) ??
    checkModelStringFormat(processEnv['AI_MODEL']) ??
    checkTemperatureRange(processEnv['AI_TEMPERATURE']) ??
    checkMaxTokensRange(processEnv['AI_MAX_TOKENS'])
  return message === undefined ? Effect.void : Effect.fail(new AppValidationError(message))
}
