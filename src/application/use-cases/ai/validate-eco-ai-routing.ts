/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { parseAiProviderPrecedence, resolveOllamaBaseUrl } from '@/domain/models/env/ai-eco-routing'

/**
 * Startup gate for `ECO_AI_PROVIDER_PRECEDENCE=local-only`: a local-only
 * deployment has no cloud fall-back, so the runtime refuses to start unless a
 * reachable Ollama instance is configured. Other precedences (`local-first`,
 * `cloud-first`) tolerate an absent/unreachable Ollama at startup — the
 * resolver simply routes to the configured cloud provider — so this check is
 * a no-op for them.
 *
 * `probeOllama` is injected (the real fetch-based probe lives in
 * `@/infrastructure/ai/ollama-reachability`) so this use-case stays unit-testable.
 */
export const validateEcoAiRouting = (
  processEnv: Readonly<Record<string, string | undefined>>,
  probeOllama: (baseUrl: string | undefined) => Promise<boolean>
): Effect.Effect<void, AppValidationError> =>
  Effect.gen(function* () {
    const precedence = parseAiProviderPrecedence(processEnv)
    if (precedence !== 'local-only') return

    const ollamaBaseUrl = resolveOllamaBaseUrl(processEnv)
    if (ollamaBaseUrl === undefined) {
      return yield* Effect.fail(
        new AppValidationError(
          'ECO_AI_PROVIDER_PRECEDENCE=local-only requires a local Ollama instance, but Ollama is unreachable: no OLLAMA_BASE_URL (or AI_BASE_URL with AI_PROVIDER=ollama) is configured.'
        )
      )
    }

    const reachable = yield* Effect.promise(() => probeOllama(ollamaBaseUrl))
    if (!reachable) {
      return yield* Effect.fail(
        new AppValidationError(
          `ECO_AI_PROVIDER_PRECEDENCE=local-only requires a reachable local Ollama instance, but Ollama at ${ollamaBaseUrl} is unreachable.`
        )
      )
    }
  })
