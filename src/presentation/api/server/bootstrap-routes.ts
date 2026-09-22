/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bootstrap Claim Route — `POST /api/admin/bootstrap/claim`
 *
 * Mounts ONLY when Sovrium is in "no-config" bootstrap mode:
 *
 *   - `process.env.AUTH_ADMIN_EMAIL` is not set (env-var bootstrap path
 *     would already provision the first admin), AND
 *   - the auth.user table is empty (some user already exists → the
 *     bootstrap window has closed).
 *
 * The mode check happens at request time (not at boot) so the route
 * naturally returns 404 once an admin has been provisioned, without
 * requiring a server restart.
 *
 * Authentication: bearer token in `Authorization` header. The token
 * was printed to stdout by `generateBootstrapTokenIfNeeded` at boot.
 *
 * Body: `{ email, password, name }`. Validated client-side via Zod is
 * a Phase 3 concern; here we accept the request body as-is and let
 * Better Auth's `createUser` API handle final validation.
 */

import { Data, Effect, Layer } from 'effect'
import { type Hono, type Context } from 'hono'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { claimBootstrapToken } from '@/application/use-cases/auth/bootstrap-token'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { BootstrapTokenRepositoryLive } from '@/infrastructure/database/repositories/auth/bootstrap-token-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import {
  badRequest,
  errorBody,
  internalError,
  notFound,
} from '@/presentation/api/runtime/auth-helpers'
import type { App } from '@/domain/models/app'

interface ClaimRequestBody {
  readonly email?: unknown
  readonly password?: unknown
  readonly name?: unknown
}

/**
 * Whether this instance is still waiting for its first administrator.
 *
 * Reads the user count through `AuthRepository` off the request's domain
 * services rather than through a live `db` handle (W5b). The count query itself
 * is unchanged — same table, same projection.
 *
 * The failure branch is load-bearing and its RESPONSE is preserved exactly: if
 * the user table cannot be queried at all (`DATABASE_URL` unset during local
 * dev, a partial migration), this reports "not bootstrap mode" so the route
 * answers 404 rather than leaking a 500 that would tell an anonymous caller the
 * endpoint exists. `Effect.orElseSucceed` is the same policy the `catch`
 * expressed, stated where the type can see it.
 *
 * The cause is now LOGGED on the way past, which the bare `catch` did not do
 * (standing rule E6). An unreachable user table is an operator problem that
 * used to present only as a 404 on an endpoint nobody had reached for yet.
 */
const isBootstrapMode = async (c: Context): Promise<boolean> => {
  if (process.env.AUTH_ADMIN_EMAIL) return false
  const userCount = await runDomainPromise(
    c,
    Effect.gen(function* () {
      const authRepository = yield* AuthRepository
      return yield* authRepository.countUsers
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[bootstrap] user-count probe failed', cause))
      ),
      // effect-swallow: a probe failure must present as "not bootstrap mode" (404),
      // never as a 500 — the status is what keeps this endpoint from confirming
      // its own existence to an anonymous caller. The cause is logged above.
      // -1 rather than a large number so the value can never equal 0 by accident.
      Effect.orElseSucceed(() => -1)
    )
  )
  return userCount === 0
}

const extractBearer = (header: string | undefined): string | undefined => {
  if (!header || !header.toLowerCase().startsWith('bearer ')) return undefined
  return header.slice(7).trim() || undefined
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/**
 * Parse the request body. Returns `undefined` when the body is not
 * valid JSON (extracted into a helper so the route handler can stay
 * `const`-only — `let`-rebinding is forbidden by `functional/no-let`).
 */
const parseClaimBody = async (
  request: Readonly<Request>
): Promise<ClaimRequestBody | undefined> => {
  try {
    return (await request.json()) as ClaimRequestBody
  } catch {
    return undefined
  }
}

interface ValidatedBody {
  readonly token: string
  readonly email: string
  readonly password: string
  readonly name: string
}

/**
 * Run the bootstrap-token claim Effect program with the necessary
 * Live layers + dynamic auth layer for the active app config.
 */
/** The lazily-imported Better Auth layer module could not be loaded. */
class BootstrapAuthModuleError extends Data.TaggedError('BootstrapAuthModuleError')<{
  readonly cause: unknown
}> {}

const runClaim = (validated: ValidatedBody, authConfig: NonNullable<App['auth']>) =>
  Effect.gen(function* () {
    // A dynamic import rejects when the module is missing or throws while
    // evaluating. Inside `Effect.promise` that was a defect, so a broken auth
    // module answered this route with an unhandled crash rather than the 500
    // its own failure branch already knows how to render.
    const { createAuthLayer } = yield* Effect.tryPromise({
      try: () => import('@/infrastructure/auth/better-auth/layer'),
      catch: (cause) => new BootstrapAuthModuleError({ cause }),
    })
    const combined = Layer.mergeAll(
      BootstrapTokenRepositoryLive,
      AuthRepositoryLive,
      createAuthLayer(authConfig)
    )
    return yield* claimBootstrapToken(validated).pipe(Effect.provide(combined))
  })

const handleClaim = async (c: Context, app: App) => {
  if (!app.auth) {
    return notFound(c, 'Bootstrap not available')
  }

  if (!(await isBootstrapMode(c))) {
    return notFound(c, 'Bootstrap not available')
  }

  const token = extractBearer(c.req.header('authorization'))
  if (!token) {
    return c.json(
      errorBody({ error: 'Missing bootstrap token', code: ApiErrorCode.UNAUTHORIZED }),
      401
    )
  }

  const body = await parseClaimBody(c.req.raw)
  if (body === undefined) {
    return badRequest(c, 'Invalid JSON body')
  }

  if (!isString(body.email) || !isString(body.password) || !isString(body.name)) {
    return badRequest(c, 'Missing required fields: email, password, name')
  }

  const result = await Effect.runPromise(
    runClaim({ token, email: body.email, password: body.password, name: body.name }, app.auth).pipe(
      Effect.result
    )
  )

  if (result._tag === 'Failure') {
    const err = result.failure
    switch (err._tag) {
      case 'BootstrapTokenNotFoundError':
      case 'BootstrapTokenExpiredError':
      case 'BootstrapTokenAlreadyUsedError':
        return c.json(
          errorBody({
            error: 'Invalid or expired bootstrap token',
            code: ApiErrorCode.UNAUTHORIZED,
          }),
          401
        )
      case 'BootstrapAdminCreationError':
        logError('[bootstrap] admin creation failed', err.cause as Error)
        return internalError(c, 'Failed to create admin user')
      default:
        logError('[bootstrap] database error', err as unknown as Error)
        return internalError(c)
    }
  }

  return c.json({ success: true, userId: result.success.userId, email: result.success.email }, 200)
}

/**
 * Mount `POST /api/admin/bootstrap/claim`. The route is ALWAYS present
 * but returns 404 outside bootstrap mode — this keeps the API shape
 * stable (no surprise route appearance after restart) while still
 * matching the spec contract that expects 404 once an admin exists.
 *
 * @param honoApp the Hono instance to chain the route onto
 * @param app the active App configuration; the route reads `app.auth`
 *            to construct the Better Auth Effect Layer
 */
export const setupBootstrapRoutes = (honoApp: Readonly<Hono>, app: App): Readonly<Hono> =>
  honoApp.post('/api/admin/bootstrap/claim', (c) => handleClaim(c, app))
