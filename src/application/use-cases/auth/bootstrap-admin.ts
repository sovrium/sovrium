/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import { AccountProvisioner } from '@/application/ports/services/account-provisioner'
import { isValidEmail } from '@/domain/kernel/sanitize/email-validation'
import { getStrategy } from '@/domain/models/app/auth'
import { PLATFORM_SSO_PROVIDER_ID } from '@/domain/models/process-env/platform-sso'
import { Logger } from '@/infrastructure/logging/logger'
import {
  ADMIN_EMAIL_WITHOUT_WAY_IN_WARNING,
  adminEmailWithoutWayIn,
  parseAdminBootstrapConfig,
  type AdminBootstrap,
  type AdminBootstrapConfig,
  type PlatformAdminSeed,
} from './admin-bootstrap-config'
import type { App } from '@/domain/models/app'
import type { Context } from 'effect'

/**
 * Admin bootstrap error types
 */
export class InvalidEmailError extends Data.TaggedError('InvalidEmailError')<{
  readonly email: string
}> {}

export class WeakPasswordError extends Data.TaggedError('WeakPasswordError')<{
  readonly message: string
}> {}

export class BootstrapDatabaseError extends Data.TaggedError('BootstrapDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * The operator-facing text of a {@link BootstrapDatabaseError}. The tagged
 * error's own `message` is empty — the real failure is its `cause` — so every
 * place that prints one reads it through here.
 */
export const describeBootstrapDatabaseError = (error: Readonly<BootstrapDatabaseError>): string =>
  error.cause instanceof Error ? error.cause.message : String(error.cause)

export { parseAdminBootstrapConfig, type AdminBootstrapConfig } from './admin-bootstrap-config'

/**
 * Validate password strength (minimum 8 characters)
 */
const isValidPassword = (password: string): boolean => {
  return password.length >= 8
}

/**
 * Create admin user via Better Auth server-side API
 * Uses Better Auth's createUser API directly for server-side user creation.
 * Handles idempotency by checking for duplicate email errors.
 *
 * IMPORTANT: We use auth.api.createUser instead of:
 * 1. auth.handler - requires HTTP request context that may not work during bootstrap
 * 2. signUpEmail - would send verification email even when we don't want it
 *
 * Role assignment is EXPLICIT — the `role` field below carries it. Nothing in
 * the stack promotes a user implicitly: Better Auth assigns every sign-up
 * `defaultRole ?? 'user'` unconditionally, and Sovrium's `databaseHooks` never
 * touch `user.role`. In particular there is no "first user becomes admin" and
 * no email-pattern promotion (both were previously claimed here and neither
 * exists). Apart from this bootstrap, the only routes to `role='admin'` are
 * `POST /api/auth/admin/set-role` called by an existing admin, the
 * `sovrium admin create` CLI, and a direct database write.
 *
 * @param requireEmailVerification - If true, triggers verification email workflow
 * @returns Effect that yields { alreadyExists: boolean, userId?: string }
 */
const createAdminUser = (
  accounts: Context.Service.Shape<typeof AccountProvisioner>,
  config: Readonly<AdminBootstrapConfig>,
  requireEmailVerification: boolean
): Effect.Effect<
  { alreadyExists: boolean; userId?: string },
  BootstrapDatabaseError | AuthDatabaseError,
  AuthRepository
> =>
  Effect.gen(function* () {
    // Attempt to create user
    const result = yield* accounts
      .createUser({
        email: config.email,
        password: config.password,
        name: config.name,
        // A custom AUTH_ADMIN_ROLE seeds the app's own role.
        role: config.role ?? 'admin',
      })
      .pipe(
        Effect.mapError((error) => new BootstrapDatabaseError({ cause: error.cause })),
        Effect.catch((dbError) => {
          // If user already exists, return success (idempotent behavior)
          // Check the original error cause
          const originalError = dbError.cause
          const errorMessage =
            originalError instanceof Error ? originalError.message : String(originalError)
          if (errorMessage.toLowerCase().includes('already exists')) {
            return Effect.succeed({ alreadyExists: true })
          }

          // For other errors, re-fail with the same BootstrapDatabaseError
          return Effect.fail(dbError)
        })
      )

    // Check if we got the "already exists" marker
    if ('alreadyExists' in result && result.alreadyExists) {
      return result
    }

    // Extract user ID from the response
    const userId = 'userId' in result ? result.userId : undefined

    // Honour the requireEmailVerification flag: when verification IS required
    // we leave emailVerified=false so the verification email flow gates access;
    // otherwise we eagerly mark verified because Better Auth's createUser API
    // does not respect the emailVerified field on its own.
    if (userId && !requireEmailVerification) {
      const authRepo = yield* AuthRepository
      yield* authRepo.verifyUserEmail(userId)
    }

    return { alreadyExists: false, userId }
  })

/**
 * Validate admin bootstrap configuration
 * Returns Effect that succeeds if valid, fails with validation error otherwise
 */
const validateBootstrapConfig = (
  config: AdminBootstrapConfig
): Effect.Effect<void, InvalidEmailError | WeakPasswordError, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    if (!isValidEmail(config.email)) {
      yield* logger.debug('[bootstrap-admin] invalid email format', { email: config.email })
      return yield* new InvalidEmailError({ email: config.email })
    }

    if (!isValidPassword(config.password)) {
      yield* logger.debug('[bootstrap-admin] password too weak')
      return yield* new WeakPasswordError({
        message: 'Password must be at least 8 characters',
      })
    }
  })

/**
 * Check preconditions for admin bootstrap
 * Returns config if preconditions met, undefined if skipped
 */
const checkBootstrapPreconditions = (
  app: App,
  config: AdminBootstrap | undefined
): Effect.Effect<AdminBootstrap | undefined, never, Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    if (!config) {
      yield* logger.debug('[bootstrap-admin] no admin bootstrap config — skipping')
      return undefined
    }

    // Admin features are always enabled when auth is configured
    if (!app.auth) {
      yield* logger.debug('[bootstrap-admin] auth not configured — skipping')
      return undefined
    }

    return config
  })

/**
 * Handle post-creation logic (verification email)
 */
const handlePostCreation = (
  requireEmailVerification: boolean,
  userId: string | undefined
): Effect.Effect<void, never, Logger> =>
  Effect.gen(function* () {
    if (requireEmailVerification && userId) {
      const logger = yield* Logger
      yield* logger.debug('[bootstrap-admin] verification email required for new admin')
    }
  })

/**
 * Create an admin account from explicit credentials (CLI `sovrium admin create`).
 *
 * Unlike `bootstrapAdmin`, which reads `AUTH_ADMIN_*` env vars at server boot,
 * this takes the credentials directly so an operator can create an admin
 * on demand. It reuses the same validation + Better Auth `createUser` path,
 * so it is idempotent: re-running for an existing email reports
 * `alreadyExists` rather than failing.
 *
 * The caller is responsible for confirming `app.auth` is configured (an admin
 * cannot be created without the admin plugin) and for running database
 * migrations beforehand so the `auth_user` table exists.
 */
export const createAdminAccount = (
  app: App,
  config: AdminBootstrapConfig
): Effect.Effect<
  { readonly alreadyExists: boolean; readonly userId?: string },
  InvalidEmailError | WeakPasswordError | BootstrapDatabaseError | AuthDatabaseError,
  AccountProvisioner | AuthRepository | Logger
> =>
  Effect.gen(function* () {
    yield* validateBootstrapConfig(config)
    const accounts = yield* AccountProvisioner
    const emailAndPasswordStrategy = getStrategy(app.auth, 'emailAndPassword')
    const requireEmailVerification = emailAndPasswordStrategy?.requireEmailVerification ?? false
    return yield* createAdminUser(accounts, config, requireEmailVerification)
  }).pipe(Effect.withSpan('auth.create-admin-account'))

/**
 * Seed the first admin of an app hosted on Sovrium Cloud: a user with no
 * password, bound to the owner's Cloud user id, who signs in with Sovrium
 * Cloud. Mints no bootstrap token (the caller's `AUTH_ADMIN_EMAIL` closes that
 * window).
 */
const seedPlatformAdmin = (
  seed: PlatformAdminSeed
): Effect.Effect<void, InvalidEmailError | BootstrapDatabaseError, AccountProvisioner | Logger> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    if (!isValidEmail(seed.email)) return yield* new InvalidEmailError({ email: seed.email })
    const accounts = yield* AccountProvisioner
    yield* accounts
      .createBoundUser({
        email: seed.email,
        name: seed.name,
        role: seed.role,
        providerId: PLATFORM_SSO_PROVIDER_ID,
        accountId: seed.subject,
      })
      .pipe(Effect.mapError((error) => new BootstrapDatabaseError({ cause: error.cause })))
    yield* logger.debug('[bootstrap-admin] admin bound to its Sovrium Cloud user', {
      email: seed.email,
    })
  })

/** The password path: today's `AUTH_ADMIN_EMAIL` + `AUTH_ADMIN_PASSWORD` seed. */
const seedPasswordAdmin = (
  app: App,
  config: AdminBootstrapConfig
): Effect.Effect<
  void,
  InvalidEmailError | WeakPasswordError | BootstrapDatabaseError | AuthDatabaseError,
  AccountProvisioner | AuthRepository | Logger
> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    yield* validateBootstrapConfig(config)
    const accounts = yield* AccountProvisioner
    const emailAndPasswordStrategy = getStrategy(app.auth, 'emailAndPassword')
    const requireEmailVerification = emailAndPasswordStrategy?.requireEmailVerification ?? false
    const { alreadyExists, userId } = yield* createAdminUser(
      accounts,
      config,
      requireEmailVerification
    )
    if (alreadyExists) {
      yield* logger.debug('[bootstrap-admin] skipped — admin user already exists', {
        email: config.email,
      })
      return
    }
    yield* logger.debug('[bootstrap-admin] admin account created', { email: config.email })
    yield* handlePostCreation(requireEmailVerification, userId)
  })

/**
 * Bootstrap admin account at application startup
 *
 * This use case seeds the first admin when:
 * 1. Admin bootstrap environment variables are set — a password, or the
 *    platform sign-in naming the owner's Cloud user (see {@link AdminBootstrap})
 * 2. Auth is configured
 * 3. The app holds no human user yet
 * 4. The email (and the password, on that path) meet validation requirements
 *
 * `AUTH_ADMIN_EMAIL` set with neither a password nor the platform sign-in seeds
 * nobody; on an empty app that leaves no way in, so it is said at startup.
 *
 * Idempotent: an app that already has a human user is left alone.
 */
export const bootstrapAdmin = (
  app: App
): Effect.Effect<
  void,
  InvalidEmailError | WeakPasswordError | BootstrapDatabaseError | AuthDatabaseError,
  AccountProvisioner | AuthRepository | Logger
> =>
  Effect.gen(function* () {
    const parsedConfig = parseAdminBootstrapConfig()
    const unreachable = app.auth !== undefined && adminEmailWithoutWayIn()
    const config = yield* checkBootstrapPreconditions(app, parsedConfig)
    if (!config && !unreachable) return

    // When a HUMAN user already exists, the env-var path no-ops entirely — no
    // recreate, no env-admin user, and (because this skip happens BEFORE
    // token-generation also short-circuits on human-user-count > 0 inside
    // generateBootstrapTokenIfNeeded) no token either.
    //
    // We count only sign-in-capable users (`countHumanUsers`), NOT every row in
    // `auth.user`: apps that declare `app.agents[]` mirror each agent into
    // `auth.user` as a synthetic `type='agent'` service identity with no
    // `auth.account` row. Counting those agent users here would make the
    // env-var admin bootstrap wrongly no-op for any agent-bearing app, leaving
    // the operator with no admin account to sign in as.
    const logger = yield* Logger
    const authRepo = yield* AuthRepository
    const existingUserCount = yield* authRepo.countHumanUsers
    if (existingUserCount > 0) {
      yield* logger.debug(
        '[bootstrap-admin] skipped — human user(s) already exist (env-var bootstrap no-op)',
        { humanUsers: String(existingUserCount) }
      )
      return
    }
    if (!config) return yield* logger.warn(ADMIN_EMAIL_WITHOUT_WAY_IN_WARNING)
    return config.kind === 'platform-sso'
      ? yield* seedPlatformAdmin(config)
      : yield* seedPasswordAdmin(app, config)
  }).pipe(Effect.withSpan('auth.bootstrap-admin'))
