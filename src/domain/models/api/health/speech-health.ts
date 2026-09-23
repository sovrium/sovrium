/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import {
  parseSpeechEnv,
  resolveSpeechTierModel,
  SUPPORTED_SPEECH_PROVIDERS,
} from '@/domain/models/process-env/ai/speech'

/**
 * Speech-to-text status reported by `GET /api/health`.
 *
 * `status` is `'configured'` when `STT_PROVIDER` names a speech provider, and
 * the payload then names that provider and the model each quality tier
 * resolves to — the one fact an operator cannot read off the env file alone,
 * because a tier without its own variable falls back to `STT_MODEL`. The
 * credential (`STT_API_KEY`) and the endpoint URL are never reported.
 */
export const speechHealthStatusSchema = Schema.Struct({
  status: Schema.Literals(['configured', 'not_configured']).annotate({
    description: 'Whether a speech-to-text provider is configured via STT_PROVIDER',
  }),
  provider: optionalField(
    Schema.Literals(SUPPORTED_SPEECH_PROVIDERS).annotate({
      description: 'Configured speech provider (STT_PROVIDER)',
    })
  ),
  models: optionalField(
    Schema.Struct({
      fast: optionalField(
        Schema.String.annotate({ description: 'Model the "fast" tier resolves to' })
      ),
      accurate: optionalField(
        Schema.String.annotate({ description: 'Model the "accurate" tier resolves to' })
      ),
    }).annotate({ description: 'The model each speech quality tier resolves to' })
  ),
})

export type SpeechHealthStatus = typeof speechHealthStatusSchema.Type

/**
 * Build the `speech` health object from an env snapshot. Pure. An unset or
 * invalid `STT_*` reports `not_configured` (an invalid one never boots past
 * startup validation anyway).
 */
export const buildSpeechHealthStatus = (
  processEnv: Readonly<Record<string, string | undefined>>
): SpeechHealthStatus => {
  const parsed = parseSpeechEnv(processEnv)
  const config = parsed.ok ? parsed.config : undefined
  if (config === undefined) return { status: 'not_configured' }
  const fast = resolveSpeechTierModel(config, 'fast')
  const accurate = resolveSpeechTierModel(config, 'accurate')
  return {
    status: 'configured',
    provider: config.provider,
    models: {
      ...(fast !== undefined ? { fast } : {}),
      ...(accurate !== undefined ? { accurate } : {}),
    },
  }
}
