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

import { Effect } from 'effect'
import { type Hono, type Context } from 'hono'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { claimBootstrapToken } from '@/application/use-cases/auth/bootstrap-token'
import { ApiErrorCode } from '@/domain/models/api/error'
import { bootstrapClaimResponseSchema } from '@/domain/models/api/server/bootstrap'
import { logError } from '@/infrastructure/logging/logger'
import {
  badRequest,
  errorBody,
  internalError,
  notFound,
} from '@/presentation/api/runtime/auth-helpers'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'

interface ClaimRequestBody {
  readonly email?: unknown
  readonly password?: unknown
  readonly name?: unknown
}

/**
 * Whether this instance is still waiting for its first administrator.
 *
 * Reads the count of people who can sign in through `AuthRepository` off the
 * request's domain services, the same count the boot uses to decide whether to
 * print a token: the account an app's agent is stored as is not a person, so
 * it never closes the door before the first administrator arrives.
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
const isBootstrapMode = () =>
  Effect.gen(function* () {
    if (process.env.AUTH_ADMIN_EMAIL) return false
    const userCount = yield* Effect.gen(function* () {
      const authRepository = yield* AuthRepository
      return yield* authRepository.countHumanUsers
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
    return userCount === 0
  })

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

const handleClaim = (c: Context, app: App) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        if (!app.auth) {
          return notFound(c, 'Bootstrap not available')
        }

        if (!(yield* isBootstrapMode())) {
          return notFound(c, 'Bootstrap not available')
        }

        const token = extractBearer(c.req.header('authorization'))
        if (!token) {
          return c.json(
            errorBody({ error: 'Missing bootstrap token', code: ApiErrorCode.UNAUTHORIZED }),
            401
          )
        }

        // effect-promise: total -- a body that is not JSON is caught there and read as none.
        const body = yield* Effect.promise(() => parseClaimBody(c.req.raw))
        if (body === undefined) {
          return badRequest(c, 'Invalid JSON body')
        }

        if (!isString(body.email) || !isString(body.password) || !isString(body.name)) {
          return badRequest(c, 'Missing required fields: email, password, name')
        }

        // The claim runs on the server's domain services, which carry the bootstrap
        // token store, the auth repository and the account provisioner built over
        // this app's own auth engine.
        const result = yield* claimBootstrapToken({
          token,
          email: body.email,
          password: body.password,
          name: body.name,
        }).pipe(Effect.result)

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
              logError('[bootstrap] database error', err as Error)
              return internalError(c)
          }
        }

        return shapedJson(
          c,
          { success: true, userId: result.success.userId, email: result.success.email },
          bootstrapClaimResponseSchema
        )
      })
    )
  )

/**
 * Mount `POST /api/admin/bootstrap/claim`. The route is ALWAYS present
 * but returns 404 outside bootstrap mode — this keeps the API shape
 * stable (no surprise route appearance after restart) while still
 * matching the spec contract that expects 404 once an admin exists.
 *
 * @param honoApp the Hono instance to chain the route onto
 * @param app the active App configuration; the route reads `app.auth`
 *            to decide whether the route answers at all
 */
export const setupBootstrapRoutes = (honoApp: Readonly<Hono>, app: App): Readonly<Hono> =>
  honoApp.post('/api/admin/bootstrap/claim', (c) => handleClaim(c, app))
