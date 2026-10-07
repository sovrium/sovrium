/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import {
  BootstrapDatabaseError,
  bootstrapAdmin,
  describeBootstrapDatabaseError,
} from '@/application/use-cases/auth/bootstrap-admin'
import {
  generateBootstrapTokenIfNeeded,
  type BootstrapTokenBootContext,
} from '@/application/use-cases/auth/bootstrap-token'
import type { StartServerRequirements } from './start-server-options'
import type { BootstrapTokenRepository } from '@/application/ports/repositories/auth/bootstrap-token-repository'
import type { App } from '@/domain/models/app'
import type { Logger } from '@/infrastructure/logging/logger'
import type { Context } from 'effect'

/**
 * The first-boot bootstrap of a server: the first admin from the environment,
 * or the one-time token that lets the first visitor create it.
 */

/**
 * Tagged error for the boot-time bootstrap-token flow. We wrap any
 * downstream cause in `cause` so the catch site can pretty-print it
 * without losing the original.
 */
class BootstrapTokenBootError extends Data.TaggedError('BootstrapTokenBootError')<{
  readonly cause: unknown
}> {}

/**
 * Determine whether the auth.user table holds any HUMAN (sign-in-capable)
 * user. Returns false on any error (DATABASE_URL unset, network blip) so the
 * boot continues without forcing a bootstrap-token print.
 *
 * Delegates the count to `AuthRepository.countHumanUsers`, which counts only
 * users backed by an `auth.account` row — an INNER JOIN excludes synthetic
 * `type='agent'` service identities, which carry no account and cannot sign in.
 * Without that, an app declaring `app.agents[]` would have a non-empty
 * `auth.user` table at boot purely from its agent users, suppressing the
 * no-config first-admin bootstrap token even though no real admin was ever
 * provisioned.
 */
const userTableIsEmpty = (): Effect.Effect<boolean, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return (yield* repo.countHumanUsers) === 0
  }).pipe(
    // effect-swallow: "cannot tell" must read as "not empty" — a DATABASE_URL that is unset or a network blip has to let the boot continue, and the conservative answer is the one that does NOT print a bootstrap token.
    Effect.orElseSucceed(() => false)
  )

/**
 * Generate a one-time bootstrap token at boot when applicable, and
 * RETURN the plaintext so the caller can fold it into the clean startup
 * banner (no separator-bar block, no separate `[INFO]` log line — the
 * banner is the single canonical surface).
 *
 * Returns `undefined` when no token was generated (env-var bootstrap is in
 * play, a user already exists, or no auth is configured).
 */
const runBootstrapTokenFlow = (
  app: Readonly<{ readonly auth?: unknown }>
): Effect.Effect<
  string | undefined,
  BootstrapTokenBootError,
  AuthRepository | BootstrapTokenRepository
> =>
  Effect.gen(function* () {
    // No auth configured → no admin to bootstrap → skip silently.
    if (!app.auth) return undefined

    const empty = yield* userTableIsEmpty()
    const ctx: BootstrapTokenBootContext = {
      hasAuthAdminEmailEnv: Boolean(process.env.AUTH_ADMIN_EMAIL),
      userTableIsEmpty: empty,
    }

    const result = yield* generateBootstrapTokenIfNeeded(ctx).pipe(
      Effect.mapError((cause) => new BootstrapTokenBootError({ cause }))
    )

    return result.kind === 'generated' ? result.plaintext : undefined
  })

/**
 * Use case for starting an Sovrium web server
 *
 * This orchestrates the server startup process:
 * 1. Validates the app configuration using Effect Schema
 * 2. Obtains rendering and server creation services via Effect Context
 * 3. Creates and starts the server via injected dependencies
 * 4. Bootstraps admin account if configured via environment variables
 *
 * Dependencies are declared in the returned Effect's requirement channel and
 * discharged by the composition root that owns a runtime (standing rule E1).
 *
 * @param app - Application configuration
 * @param options - Server configuration options
 * @returns Effect that yields ServerInstance or errors
 *
 * @example
 * ```typescript
 * // In the CLI start command — the composition root discharges the
 * // requirements this Effect declares.
 * const program = startServer(appConfig, { port: 3000 }).pipe(
 *   Effect.provide(createAppLayer(appConfig.auth))
 * )
 * ```
 */

/**
 * Format a bootstrap-admin failure for the warning log. `BootstrapDatabaseError`
 * carries the real failure on `.cause`; the tagged error's own `.message`
 * is empty — surface the cause so a bootstrap failure stays diagnosable.
 */
const formatBootstrapError = (error: Readonly<{ readonly message: string }>): string =>
  error instanceof BootstrapDatabaseError ? describeBootstrapDatabaseError(error) : error.message

/** "No token was generated" — the union member, not a throwaway void. */
const NO_BOOTSTRAP_TOKEN: string | undefined = undefined

export const bootstrapAdminAndToken = (
  validatedApp: App,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<string | undefined, never, StartServerRequirements> =>
  Effect.gen(function* () {
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catch((error) => logger.warn(`Admin bootstrap error: ${formatBootstrapError(error)}`))
    )
    return yield* runBootstrapTokenFlow(validatedApp).pipe(
      Effect.catch((error) => {
        const { cause } = error
        const message = cause instanceof Error ? cause.message : String(cause)
        return Effect.andThen(
          logger.warn(`Bootstrap token generation skipped: ${message}`),
          // NOT `Effect.void`: this recovery branch must match
          // `runBootstrapTokenFlow`'s `string | undefined` success type, since the
          // happy path returns a token string. The value participates in a union,
          // it is not a throwaway void.
          Effect.succeed(NO_BOOTSTRAP_TOKEN)
        )
      })
    )
  }).pipe(Effect.withSpan('server.bootstrap-admin-and-token'))
