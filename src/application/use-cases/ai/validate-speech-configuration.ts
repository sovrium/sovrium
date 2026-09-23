/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { appRequiresAi } from '@/domain/models/app/requires-ai'
import { parseSpeechEnv, speechPrecedenceRefusal } from '@/domain/models/process-env/ai/speech'
import type { App } from '@/domain/models/app'

/**
 * Startup refusal for the `STT_*` speech-to-text variables, or
 * `undefined` when the boot may proceed. Folded into
 * `validateAiConfiguration`'s refusal chain, so it runs before the listener
 * binds and fails the boot with the same `AppValidationError`.
 *
 * Two refusals:
 *
 * - a SET but invalid variable (an unknown `STT_PROVIDER`, a non-URL
 *   `STT_BASE_URL`, a non-numeric limit) — the operator meant to turn speech
 *   on, and a silent inert service would hide the typo;
 * - `ECO_AI_PROVIDER_PRECEDENCE=local-only` with a CLOUD speech provider —
 *   local-only promises that no recording leaves the machine.
 *
 * The precedence refusal is about the app, like `validateEcoAiRouting`'s: an
 * app with no AI surface boots whatever the host's speech settings say. An
 * UNSET `STT_PROVIDER` is never refused — speech is simply off, and a
 * transcription step fails with a readable reason instead.
 */
export const speechConfigurationRefusal = (
  app: Readonly<App>,
  processEnv: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const parsed = parseSpeechEnv(processEnv)
  if (!parsed.ok) return parsed.error
  const { config } = parsed
  if (config === undefined || !appRequiresAi(app)) return undefined
  return speechPrecedenceRefusal(config, processEnv)
}
