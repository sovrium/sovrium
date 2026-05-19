/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { parseAiProviderPrecedence, resolveOllamaBaseUrl } from '@/domain/models/env/ai-eco-routing'

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
