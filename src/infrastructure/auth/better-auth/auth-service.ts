/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect, Layer } from 'effect'
import { AuthError } from '../../errors/auth-error'
import type { createAuthInstance } from './auth'

// Re-export AuthError for convenience
export { AuthError }

/**
 * The shape `betterAuth` hands back.
 *
 * Derived from the factory rather than from a module-level default instance:
 * that instance was deleted because evaluating it at import time made a keyless
 * `sovrium init --help` provision a root secret. A type alias costs nothing at
 * runtime and expresses the same thing.
 *
 * The import is `import type` DELIBERATELY, and it is what makes this module
 * loadable without the `better-auth` package. `./auth` pulls `betterAuth`, the
 * drizzle adapter and every plugin — 356 ms of a 730 ms cold boot — so a value
 * import here would defeat the whole point of splitting the tag out of
 * `./layer`. Keep it type-only.
 */
type AuthInstance = ReturnType<typeof createAuthInstance>

/**
 * Auth Effect Context
 *
 * Provides authentication service for dependency injection in Effect programs.
 * Use this in Application layer to access authentication without direct imports.
 *
 * Implementation uses Better Auth library internally.
 *
 * This tag lives HERE rather than in `./layer` so that naming it costs nothing
 * at runtime. `./layer` holds `createAuthLayer`, which builds a real Better
 * Auth instance and therefore drags the package in; the tag is just an
 * identity. Splitting them lets `app-layer.ts` reference `Auth` on every boot
 * while loading `./layer` only when the app actually declares `auth`.
 *
 * @example
 * ```typescript
 * const protectedProgram = Effect.gen(function* () {
 *   const authService = yield* Auth
 *   const session = yield* authService.requireSession(headers)
 *   return { userId: session.user.id, email: session.user.email }
 * })
 * ```
 */
export class Auth extends Context.Service<
  Auth,
  {
    readonly api: AuthInstance['api']
    readonly handler: AuthInstance['handler']
    readonly getSession: (
      headers: Headers
    ) => Effect.Effect<Awaited<ReturnType<AuthInstance['api']['getSession']>>, AuthError>
    readonly requireSession: (
      headers: Headers
    ) => Effect.Effect<
      NonNullable<Awaited<ReturnType<AuthInstance['api']['getSession']>>>,
      AuthError
    >
  }
>()('Auth') {}

const NOT_CONFIGURED = 'Auth is not configured for this app'

/**
 * `api` and `handler` have no meaningful no-auth value, so they refuse on
 * ACCESS rather than resolving to a silent no-op. A Proxy is used for `api`
 * because it is an object of many methods and every one of them must refuse;
 * reading any property throws with the same message a caller would get from
 * `getSession`.
 *
 * Reaching either of these is a BUG, not a supported path — see `NoAuthLayer`.
 */
const refuse = (): never => {
  // eslint-disable-next-line functional/no-throw-statements -- unreachable-by-construction guard; a silent no-op here would hide the wiring bug that reached it
  throw new Error(`${NOT_CONFIGURED}. This code path requires an \`auth:\` block.`)
}

const unavailableApi = new Proxy({} as AuthInstance['api'], { get: refuse, apply: refuse })

/**
 * Auth Layer for an app that declares no `auth:` block.
 *
 * Every `yield* Auth` in the codebase sits behind an `app.auth` check —
 * `bootstrapAdmin` returns early when `validateBootstrapConfig` yields
 * `undefined`, `createAdminAccount` is only called past `createAdmin`'s
 * explicit guard, and `claimBootstrapToken` is only reached past
 * `handleClaim`'s 404 — so this layer's session methods are unreachable in
 * practice. It exists because `startServer` declares `Auth` in its `R`
 * (`start-server.ts`): omitting the service entirely would make
 * `createAppLayer`'s return type conditional on whether an `auth:` block was
 * present, which every caller would then have to reason about.
 *
 * So: a stub that FAILS rather than an absent service that complicates types.
 * Failing with `AuthError` keeps the error channel identical to the real
 * layer's, so a caller that somehow reaches it degrades the same way it would
 * on a genuine Better Auth failure instead of crashing on `undefined`.
 */
export const NoAuthLayer: Layer.Layer<Auth> = Layer.succeed(
  Auth,
  Auth.of({
    api: unavailableApi,
    handler: refuse,
    getSession: () => Effect.fail(new AuthError(NOT_CONFIGURED)),
    requireSession: () => Effect.fail(new AuthError(NOT_CONFIGURED)),
  })
)
