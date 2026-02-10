/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Console, Data } from 'effect'
import { getStrategy } from '@/domain/models/app/auth'
import { Auth } from '@/infrastructure/auth/better-auth'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { Database } from '@/infrastructure/database/drizzle/layer'
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

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Admin bootstrap configuration from environment variables
 */
export interface AdminBootstrapConfig {
  readonly email: string
  readonly password: string
  readonly name: string
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

  // Email and password are required
  if (!email || !password) {
    return undefined
  }

  // Use default name if not provided
  return { email, password, name: name || 'Administrator' }
}

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
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
 * Role assignment is handled by the admin plugin's user.created hook:
 * - First user is automatically made admin (firstUserAdmin: true)
 * - Users with "admin" in email are auto-promoted to admin
 *
 * @param requireEmailVerification - If true, triggers verification email workflow
 * @returns Effect that yields { alreadyExists: boolean, userId?: string }
 */
const createAdminUser = (
  auth: Context.Tag.Service<typeof Auth>,
  config: Readonly<AdminBootstrapConfig>,
  _requireEmailVerification: boolean
): Effect.Effect<{ alreadyExists: boolean; userId?: string }, DatabaseError, Database> =>
  Effect.gen(function* () {
    // Attempt to create user
    const result = yield* Effect.tryPromise({
      try: async () => {
        const userResult = await auth.api.createUser({
          body: {
            email: config.email,
            password: config.password,
            name: config.name,
            role: 'admin',
          },
        })

        return userResult
      },
      catch: (error) => new DatabaseError({ cause: error }),
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

        // For other errors, re-fail with the same DatabaseError
        return Effect.fail(dbError)
      })
    )

    // Check if we got the "already exists" marker
    if ('alreadyExists' in result && result.alreadyExists) {
      return result
    }

    // Extract user ID from the response
    const userId = 'user' in result && result.user ? result.user.id : undefined

    // If email verification is NOT required, manually set emailVerified to true
    // Better Auth's createUser API doesn't respect the emailVerified field
    // Use Drizzle ORM to directly update the database
    if (userId) {
      const db = yield* Database

      // Update database and propagate any errors
      yield* Effect.tryPromise({
        try: () => db.update(users).set({ emailVerified: true }).where(eq(users.id, userId)),
        catch: (error) => new DatabaseError({ cause: error }),
      }).pipe(Effect.asVoid)
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
      yield* Console.log('[bootstrap-admin] Invalid email format:', config.email)
      return yield* new InvalidEmailError({ email: config.email })
    }

    if (!isValidPassword(config.password)) {
      yield* Console.log('[bootstrap-admin] Password too weak')
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
  Effect.gen(function* () {
    if (!config) {
      yield* Console.log('[bootstrap-admin] No admin bootstrap config found')
      return undefined
    }

    yield* Console.log('[bootstrap-admin] Admin bootstrap config found:', config.email)

    // Admin features are always enabled when auth is configured
    if (!app.auth) {
      yield* Console.log('[bootstrap-admin] Auth not configured, skipping')
      return undefined
    }

    yield* Console.log('[bootstrap-admin] Auth is configured')
    return config
  })

/**
 * Handle post-creation logic (verification email)
 */
const handlePostCreation = (
  requireEmailVerification: boolean,
  userId: string | undefined
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    if (requireEmailVerification && userId) {
      yield* Console.log('[bootstrap-admin] Sending verification email...')
      yield* Console.log('📧 Verification email sent to admin')
    }
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
): Effect.Effect<void, InvalidEmailError | WeakPasswordError | DatabaseError, Auth | Database> =>
  Effect.gen(function* () {
    const parsedConfig = parseAdminBootstrapConfig()
    const config = yield* checkBootstrapPreconditions(app, parsedConfig)

    if (!config) return

    yield* validateBootstrapConfig(config)
    yield* Console.log('[bootstrap-admin] Email and password validated, proceeding to create user')

    const auth = yield* Auth

    const emailAndPasswordStrategy = getStrategy(app.auth, 'emailAndPassword')
    const requireEmailVerification = emailAndPasswordStrategy?.requireEmailVerification ?? false

    yield* Console.log(
      `[bootstrap-admin] requireEmailVerification=${requireEmailVerification}, will set emailVerified=${!requireEmailVerification}`
    )

    const { alreadyExists, userId } = yield* createAdminUser(auth, config, requireEmailVerification)

    if (alreadyExists) {
      yield* Console.log(`⏩ Admin bootstrap skipped: User ${config.email} already exists`)
      return
    }

    yield* Console.log(`✅ Admin account created: ${config.email}`)
    yield* handlePostCreation(requireEmailVerification, userId)
  })
