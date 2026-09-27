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
  healthMinimalResponseSchema,
  healthResponseSchema,
} from '@/domain/models/api/health/health'
import { buildSpeechHealthStatus } from '@/domain/models/api/health/speech-health'
import { resolveOllamaBaseUrl } from '@/domain/models/process-env/ai/ai-eco-routing'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { internalError } from '@/presentation/api/runtime/auth-helpers'
import {
  resolveCallerTier,
  type ReadUserRole,
  type SessionReader,
} from '@/presentation/api/runtime/caller-tier'
import type { HealthMinimalResponse, HealthResponse } from '@/domain/models/api/health/health'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Error when health response validation fails
 */
class HealthResponseValidationError extends Data.TaggedError('HealthResponseValidationError')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** The role lookup, bound to this request's domain runtime. */
const readUserRoleInRequest =
  (c: Context): ReadUserRole =>
  async (userId) => {
    const { getUserRole } = await import('@/application/use-cases/tables/user-role')
    return runDomainPromise(c, getUserRole(userId))
  }

/**
 * Whether this request receives the detailed body. An app without
 * authentication has no caller to tell apart, so everyone does; an app with
 * authentication discloses the detail to an admin-tier session only, resolved
 * by the same {@link resolveCallerTier} the OpenAPI guard reads. A session or
 * role that cannot be resolved is treated as anonymous — the probe still
 * answers — and an app declaring authentication with no auth instance wired
 * fails closed, as the OpenAPI routes do.
 */
export const disclosesDetail = async (
  c: Context,
  app: App,
  auth: SessionReader | undefined,
  readRoleFor: (c: Context) => ReadUserRole = readUserRoleInRequest
): Promise<boolean> => {
  if (!app.auth) return true
  if (!auth) return false
  try {
    return (await resolveCallerTier(c, auth, app, readRoleFor(c))) === 'admin'
  } catch (error) {
    // Not an admin, as far as this probe can tell: the minimal body still
    // answers 200. Logged, because a session store that cannot be read is
    // worth seeing even when the probe stays green.
    logError('[Health] Caller tier could not be resolved; answering the minimal body', error)
    return false
  }
}

/** The app's declared version; the key is omitted when the app declares none. */
const appVersionField = (app: App): { readonly version?: string } =>
  app.version === undefined ? {} : { version: app.version }

/** Validate a health body, turning a decode failure into a typed error. */
const validateHealthBody = <A>(decode: (input: unknown) => A, response: unknown) =>
  Effect.try({
    try: () => decode(response),
    catch: (error) =>
      new HealthResponseValidationError({
        message: `Health response validation failed: ${error}`,
        cause: error,
      }),
  })

/** The minimal body an anonymous or non-admin caller receives. */
const minimalHealthProgram = (app: App) =>
  validateHealthBody(decodeOrThrow(healthMinimalResponseSchema), {
    status: 'ok',
    ...appVersionField(app),
  })

/** The detailed body: server, app, AI and speech status. */
const detailedHealthProgram = (app: App) =>
  Effect.gen(function* () {
    // Probe the local Ollama endpoint (if any) so the eco resolver can
    // surface `resolvedProvider` / `ollamaReachable` per ECO_AI_PROVIDER_PRECEDENCE.
    // Only the detailed body pays for it.
    // effect-promise: total -- `probeOllamaReachable` wraps its whole `fetch` in a try/catch returning `false`, and returns `false` early for an unset base URL; it reports unreachability as a value rather than a rejection.
    const ollamaReachable = yield* Effect.promise(() =>
      probeOllamaReachable(resolveOllamaBaseUrl(process.env))
    )

    const response: HealthResponse = {
      status: 'ok',
      ...appVersionField(app),
      timestamp: new Date().toISOString(),
      app: { name: app.name },
      ai: buildAiHealthStatusWithEcoRouting(process.env, ollamaReachable, app.agents ?? []),
      speech: buildSpeechHealthStatus(process.env),
    }

    return yield* validateHealthBody(decodeOrThrow(healthResponseSchema), response)
  })

/** Build and validate the health payload for one request. */
export const handleHealthCheck = async (c: Context, app: App, auth?: SessionReader) => {
  const detailed = await disclosesDetail(c, app, auth)
  const program: Effect.Effect<
    HealthResponse | HealthMinimalResponse,
    HealthResponseValidationError
  > = detailed ? detailedHealthProgram(app) : minimalHealthProgram(app)

  try {
    // Run Effect program and return result
    const data = await Effect.runPromise(program)
    return c.json(data, 200)
  } catch (error) {
    logError('[Health] Health response could not be built', error)
    // The canonical envelope, like every other 500 on this API. It used to
    // emit `{ error, code: 'HEALTH_CHECK_FAILED' }` — a body with no
    // `message`, carrying a code that is not in `ApiErrorCode` and that no
    // client could branch on.
    return internalError(c)
  }
}
