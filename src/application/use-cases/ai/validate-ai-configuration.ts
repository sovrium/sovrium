/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { validateModelString } from '@/domain/models/env/ai/ai-model-string'
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
} from '@/domain/models/env/ai/ai-providers'
import type { App } from '@/domain/models/app'

/**
 * Provider-consistency check: returns a failure message when `AI_PROVIDER`
 * is set to an unrecognised value. Returns `undefined` when the provider config
 * is internally consistent (including the unset case).
 *
 * NOTE ([internal ref] Phase 2): AI-computed table fields do NOT require a provider.
 * Under the two-phase baseline-then-refined contract the deterministic
 * baseline is the guaranteed floor — an AI-compute field is always type-valid
 * and present even with AI disabled (refinement is simply off). So a table
 * with AI-compute fields MUST boot when `AI_PROVIDER` is unset.
 *
 * NOTE: AI *agents* likewise no longer require a provider at boot.
 * When `AI_PROVIDER` is unset/empty (the operator made NO AI choice at all),
 * declared agents boot INERT — discoverable but not runnable — so a template
 * deployed without an AI key comes up as a working app with the assistant
 * simply switched off, rather than crashing. The loud-fail principle is
 * preserved for an EXPLICITLY-chosen-but-misconfigured provider: setting
 * `AI_PROVIDER` to a value with a missing API key / base URL / model still
 * fails at startup via {@link checkApiKeyPresence} / {@link checkBaseUrlPresence}
 * / {@link checkModelPresence} (those checks run whenever a provider is set).
 */
const checkProviderConsistency = (provider: string | undefined): string | undefined => {
  const supportedList = SUPPORTED_AI_PROVIDERS.join(', ')

  if (provider !== undefined && provider !== '' && !isSupportedAiProvider(provider)) {
    return `Unknown AI_PROVIDER "${provider}". Supported providers: ${supportedList}.`
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
 * Base-URL presence check: providers reached via an operator-supplied endpoint
 * (`ollama` / `openai-compatible`) must have one supplied via `AI_BASE_URL` or
 * a provider-specific alias (e.g. `OLLAMA_BASE_URL`). Returns `undefined` when
 * the provider ships with a built-in endpoint (cloud providers) or a base URL
 * is present. The error names both the provider and the accepted env var(s).
 */
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

/**
 * Model presence check: providers without a universal default model
 * (currently `openai-compatible`, which points at an arbitrary endpoint
 * whose model catalogue is operator-defined) require `AI_MODEL` to be set
 * explicitly. Returns `undefined` when the provider ships a default or a
 * model is present. The error names the provider and explains there is no
 * default to fall back to.
 */
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
    checkProviderConsistency(provider) ??
    checkApiKeyPresence(provider, processEnv) ??
    checkBaseUrlPresence(provider, processEnv) ??
    checkModelPresence(provider, processEnv) ??
    checkModelStringFormat(processEnv['AI_MODEL']) ??
    checkTemperatureRange(processEnv['AI_TEMPERATURE']) ??
    checkMaxTokensRange(processEnv['AI_MAX_TOKENS'])
  return message === undefined ? Effect.void : Effect.fail(new AppValidationError(message))
}
