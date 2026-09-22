/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { appRequiresAi } from '@/domain/models/app/requires-ai'
import {
  parseAiProviderPrecedence,
  resolveOllamaBaseUrl,
} from '@/domain/models/process-env/ai/ai-eco-routing'
import type { App } from '@/domain/models/app'

/**
 * Startup gate for `ECO_AI_PROVIDER_PRECEDENCE=local-only`: a local-only
 * deployment has no cloud fall-back, so the runtime refuses to start unless a
 * reachable Ollama instance is configured. Other precedences (`local-first`,
 * `cloud-first`) tolerate an absent/unreachable Ollama at startup — the
 * resolver simply routes to the configured cloud provider — so this check is
 * a no-op for them.
 *
 * ── THE REFUSAL IS ABOUT THE APP, NOT ABOUT ITS HOST ───────────────────────
 *
 * `ECO_AI_PROVIDER_PRECEDENCE` is an ENV var, so it is set once for a host and
 * inherited by every app that runs on it. An operator running one AI app under
 * `local-only` and one plain marketing site must not find the marketing site
 * refusing to boot because a model it never asked for is unreachable — so the
 * gate returns early for an app with no AI surface at all. What makes the
 * refusal a service to the operator rather than an obstruction is precisely
 * that the config declares something only a model can answer
 * ([internal ref] against [internal ref]).
 *
 * `probeOllama` is injected (the real fetch-based probe lives in
 * `@/infrastructure/ai/ollama-reachability`) so this use-case stays unit-testable.
 */
export const validateEcoAiRouting = (
  app: Readonly<App>,
  processEnv: Readonly<Record<string, string | undefined>>,
  probeOllama: (baseUrl: string | undefined) => Promise<boolean>
): Effect.Effect<void, AppValidationError> =>
  Effect.gen(function* () {
    if (!appRequiresAi(app)) return

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

    // effect-promise: total -- the probe wraps its whole `fetch` in a try/catch returning `false`; unreachability is its RESULT, which is exactly what this validation branches on.
    const reachable = yield* Effect.promise(() => probeOllama(ollamaBaseUrl))
    if (!reachable) {
      return yield* Effect.fail(
        new AppValidationError(
          `ECO_AI_PROVIDER_PRECEDENCE=local-only requires a reachable local Ollama instance, but Ollama at ${ollamaBaseUrl} is unreachable.`
        )
      )
    }
  }).pipe(Effect.withSpan('ai.validate-eco-ai-routing'))
