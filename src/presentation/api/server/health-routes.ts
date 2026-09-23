/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/health` — the liveness probe, and the only route `api-routes.ts`
 * ever answered inline.
 *
 * The handler lives here and the `.get` call stays in the chain: that is the
 * shape every other route family already uses, and it keeps the route in the
 * chain's inferred type rather than behind a `T`-returning helper.
 */

import { Data, Effect } from 'effect'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import {
  buildAiHealthStatusWithEcoRouting,
  healthResponseSchema,
} from '@/domain/models/api/health/health'
import { buildSpeechHealthStatus } from '@/domain/models/api/health/speech-health'
import { resolveOllamaBaseUrl } from '@/domain/models/process-env/ai/ai-eco-routing'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { internalError } from '@/presentation/api/runtime/auth-helpers'
import { getLiveApp } from '../runtime/live-app-store'
import type { HealthResponse } from '@/domain/models/api/health/health'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Error when health response validation fails
 */
class HealthResponseValidationError extends Data.TaggedError('HealthResponseValidationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** Build and validate the health payload for one request. */
export const handleHealthCheck = async (c: Context, app: App) => {
  // Use Effect.gen for functional composition
  const program = Effect.gen(function* () {
    // Probe the local Ollama endpoint (if any) so the eco resolver can
    // surface `resolvedProvider` / `ollamaReachable` per ECO_AI_PROVIDER_PRECEDENCE.
    // effect-promise: total -- `probeOllamaReachable` wraps its whole `fetch` in a try/catch returning `false`, and returns `false` early for an unset base URL; it reports unreachability as a value rather than a rejection.
    const ollamaReachable = yield* Effect.promise(() =>
      probeOllamaReachable(resolveOllamaBaseUrl(process.env))
    )
    // Build health response (explicitly typed for Zod validation)

    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      app: {
        // Read the live App name so a schema `POST /draft/publish` swap is
        // reflected here without a server restart; fall back to the boot
        // App when the live store has not been seeded.
        name: getLiveApp()?.name ?? app.name,
      },
      ai: buildAiHealthStatusWithEcoRouting(process.env, ollamaReachable, app.agents ?? []),
      speech: buildSpeechHealthStatus(process.env),
    }

    // Validate response against schema (ensures type safety)
    const validated = yield* Effect.try({
      try: () => decodeOrThrow(healthResponseSchema)(response),
      catch: (error) =>
        new HealthResponseValidationError({
          message: `Health response validation failed: ${error}`,
          cause: error,
        }),
    })

    return validated
  })

  try {
    // Run Effect program and return result
    const data = await Effect.runPromise(program)
    return c.json(data, 200)
  } catch {
    // The canonical envelope, like every other 500 on this API. It used to
    // emit `{ error, code: 'HEALTH_CHECK_FAILED' }` — a body with no
    // `message`, carrying a code that is not in `ApiErrorCode` and that no
    // client could branch on.
    return internalError(c)
  }
}
