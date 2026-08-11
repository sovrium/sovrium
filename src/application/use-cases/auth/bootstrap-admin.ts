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
import { getStrategy } from '@/domain/models/app/auth'
import { isValidEmail } from '@/domain/utils/email-validation'
import { Auth } from '@/infrastructure/auth/better-auth'
import { logDebug } from '@/infrastructure/logging/logger'
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
 * Admin bootstrap configuration from environment variables
 */
export interface AdminBootstrapConfig {
  readonly email: string
  readonly password: string
  readonly name: string
  /**
   * Role assigned to the seeded admin. Read from the optional `AUTH_ADMIN_ROLE`
   * env var, falling back to `'admin'`. Custom-role apps (e.g. cloud
   * `operator`, partner `engineer`) set it to their highest-level role so the
   * seeded admin can reach every access-gated page.
   *
   * Optional on the type until `parseAdminBootstrapConfig` populates it
   * (Phase P, Gap 2 — implemented downstream); kept optional so the additive
   * type change stays backward-compatible and typecheck-green.
   */
  readonly role?: string
}

/**
 * Parse admin bootstrap configuration from environment variables
 * Returns undefined if any required environment variable is missing (email or password)
 * Uses "Administrator" as default name if not provided
 */
export const parseAdminBootstrapConfig = (): AdminBootstrapConfig | undefined => {
  const email = process.env.AUTH_ADMIN_EMAIL
  const password = process.env.AUTH_ADMIN_PASSWORD
  const name = process.env.AUTH_ADMIN_NAME
  const role = process.env.AUTH_ADMIN_ROLE

  // Email and password are required
  if (!email || !password) {
    return undefined
  }

  // Use default name if not provided, and default role to 'admin' so the
  // additive AUTH_ADMIN_ROLE override stays backward-compatible.
  return { email, password, name: name || 'Administrator', role: role || 'admin' }
}

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
  auth: Context.Tag.Service<typeof Auth>,
  config: Readonly<AdminBootstrapConfig>,
  requireEmailVerification: boolean
): Effect.Effect<
  { alreadyExists: boolean; userId?: string },
  BootstrapDatabaseError | AuthDatabaseError,
  AuthRepository
> =>
  Effect.gen(function* () {
    // Attempt to create user
    const result = yield* Effect.tryPromise({
      try: async () => {
        const userResult = await auth.api.createUser({
          body: {
            email: config.email,
            password: config.password,
            name: config.name,
            // Better Auth types `role` as the built-in `'user' | 'admin'` union,
            // but Sovrium's admin plugin accepts arbitrary app-defined roles
            // (e.g. cloud `operator`, partner `engineer`). Cast through the
            // built-in union so a custom AUTH_ADMIN_ROLE seeds the app's own role.
            role: (config.role ?? 'admin') as 'admin',
          },
        })

        return userResult
      },
      catch: (error) => new BootstrapDatabaseError({ cause: error }),
    }).pipe(
      Effect.catchAll((dbError) => {
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
    const userId = 'user' in result && result.user ? result.user.id : undefined

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
): Effect.Effect<void, InvalidEmailError | WeakPasswordError> =>
  Effect.gen(function* () {
    if (!isValidEmail(config.email)) {
      logDebug('[bootstrap-admin] invalid email format', { email: config.email })
      return yield* new InvalidEmailError({ email: config.email })
    }

    if (!isValidPassword(config.password)) {
      logDebug('[bootstrap-admin] password too weak')
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
  config: AdminBootstrapConfig | undefined
): Effect.Effect<AdminBootstrapConfig | undefined, never> =>
  Effect.sync(() => {
    if (!config) {
      logDebug('[bootstrap-admin] no admin bootstrap config — skipping')
      return undefined
    }

    // Admin features are always enabled when auth is configured
    if (!app.auth) {
      logDebug('[bootstrap-admin] auth not configured — skipping')
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
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (requireEmailVerification && userId) {
      logDebug('[bootstrap-admin] verification email required for new admin')
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
  Auth | AuthRepository
> =>
  Effect.gen(function* () {
    yield* validateBootstrapConfig(config)
    const auth = yield* Auth
    const emailAndPasswordStrategy = getStrategy(app.auth, 'emailAndPassword')
    const requireEmailVerification = emailAndPasswordStrategy?.requireEmailVerification ?? false
    return yield* createAdminUser(auth, config, requireEmailVerification)
  })

/**
 * Bootstrap admin account at application startup
 *
 * This use case creates an admin account if:
 * 1. Admin bootstrap environment variables are set
 * 2. Admin plugin is enabled in auth configuration
 * 3. No user exists with the provided email
 * 4. Email and password meet validation requirements
 *
 * The account is created with:
 * - Verified email (emailVerified: true) - set by admin plugin hook
 * - Admin role - set by admin plugin hook
 * - Provided name and credentials
 *
 * This is idempotent - if the account already exists, Better Auth handles it gracefully.
 *
 * Uses Better Auth's signUpEmail API which doesn't require authentication.
 * The admin plugin's user.created hook should set role='admin' and emailVerified=true
 * for bootstrap users (identified by email pattern or special marker).
 *
 * @param app - Application configuration
 * @returns Effect that succeeds with void or fails with error
 */
export const bootstrapAdmin = (
  app: App
): Effect.Effect<
  void,
  InvalidEmailError | WeakPasswordError | BootstrapDatabaseError | AuthDatabaseError,
  Auth | AuthRepository
> =>
  Effect.gen(function* () {
    const parsedConfig = parseAdminBootstrapConfig()
    const config = yield* checkBootstrapPreconditions(app, parsedConfig)

    if (!config) return

    // [internal ref]: when AUTH_ADMIN_EMAIL is set but a HUMAN user
    // already exists, the env-var path no-ops entirely — no recreate, no
    // env-admin user, and (because this skip happens BEFORE token-generation
    // also short-circuits on human-user-count > 0 inside
    // generateBootstrapTokenIfNeeded) no token either.
    //
    // We count only sign-in-capable users (`countHumanUsers`), NOT every row in
    // `auth.user`: apps that declare `app.agents[]` mirror each agent into
    // `auth.user` as a synthetic `type='agent'` service identity with no
    // `auth.account` row. Counting those agent users here would make the
    // env-var admin bootstrap wrongly no-op for any agent-bearing app, leaving
    // the operator with no admin account to sign in as.
    const authRepo = yield* AuthRepository
    const existingUserCount = yield* authRepo.countHumanUsers()
    if (existingUserCount > 0) {
      logDebug(
        '[bootstrap-admin] skipped — human user(s) already exist (env-var bootstrap no-op)',
        {
          humanUsers: String(existingUserCount),
        }
      )
      return
    }

    yield* validateBootstrapConfig(config)

    const auth = yield* Auth

    const emailAndPasswordStrategy = getStrategy(app.auth, 'emailAndPassword')
    const requireEmailVerification = emailAndPasswordStrategy?.requireEmailVerification ?? false

    const { alreadyExists, userId } = yield* createAdminUser(auth, config, requireEmailVerification)

    if (alreadyExists) {
      logDebug('[bootstrap-admin] skipped — admin user already exists', { email: config.email })
      return
    }

    logDebug('[bootstrap-admin] admin account created', { email: config.email })
    yield* handlePostCreation(requireEmailVerification, userId)
  })
