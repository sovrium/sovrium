/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Console, Data } from 'effect'
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
  requireEmailVerification: boolean
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
    if (!requireEmailVerification && userId) {
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
 * Send verification email to admin user
 * Manually creates a verification token and triggers email sending
 *
 * Better Auth's email verification flow:
 * 1. Creates a verification token in the database
 * 2. Calls the sendVerificationEmail callback (configured in auth.ts)
 * 3. The callback sends the actual email with the token link
 */
const sendAdminVerificationEmail = (
  auth: Context.Tag.Service<typeof Auth>,
  userId: string,
  email: string
): Effect.Effect<void, DatabaseError, never> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: async () => {
        // Generate verification token by making a request to Better Auth
        // This triggers Better Auth's internal flow which:
        // 1. Creates the verification record in the database
        // 2. Calls our sendVerificationEmail handler (configured in auth.ts)
        const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'

        // Use Better Auth's internal API to send verification email
        // This matches the flow when a user signs up
        const response = await auth.handler(
          new Request(`${baseUrl}/api/auth/send-verification-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              callbackURL: `${baseUrl}/api/auth/verify-email`,
            }),
          })
        )

        return { response, baseUrl }
      },
      catch: (error) => new DatabaseError({ cause: error }),
    })

    if (!result.response.ok) {
      const responseText = yield* Effect.tryPromise({
        try: () => result.response.text(),
        catch: () => new DatabaseError({ cause: 'Failed to read response text' }),
      })

      return yield* Effect.fail(
        new DatabaseError({
          cause: `Failed to send verification email: ${result.response.status} - ${responseText}`,
        })
      )
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
  // eslint-disable-next-line max-statements, complexity
  Effect.gen(function* () {
    // Parse admin bootstrap config from environment variables
    const config = parseAdminBootstrapConfig()

    // Skip if config not provided
    if (!config) {
      yield* Console.log('[bootstrap-admin] No admin bootstrap config found')
      return
    }

    yield* Console.log('[bootstrap-admin] Admin bootstrap config found:', config.email)

    // Check if admin plugin is enabled
    // The admin config can be boolean (true) or an object with configuration
    const adminPluginEnabled = Boolean(app.auth?.admin)

    if (!adminPluginEnabled) {
      yield* Console.log('[bootstrap-admin] Admin plugin not enabled, skipping')
      return
    }

    yield* Console.log('[bootstrap-admin] Admin plugin is enabled')

    // Validate email format
    if (!isValidEmail(config.email)) {
      yield* Console.log('[bootstrap-admin] Invalid email format:', config.email)
      return yield* Effect.fail(new InvalidEmailError({ email: config.email }))
    }

    // Validate password strength
    if (!isValidPassword(config.password)) {
      yield* Console.log('[bootstrap-admin] Password too weak')
      return yield* Effect.fail(
        new WeakPasswordError({ message: 'Password must be at least 8 characters' })
      )
    }

    yield* Console.log('[bootstrap-admin] Email and password validated, proceeding to create user')

    // Get Auth service from Effect Context
    const auth = yield* Auth

    // Check if email verification is required
    const emailAndPasswordConfig =
      app.auth?.emailAndPassword && typeof app.auth.emailAndPassword === 'object'
        ? app.auth.emailAndPassword
        : {}
    const requireEmailVerification = emailAndPasswordConfig.requireEmailVerification ?? false

    yield* Console.log(
      `[bootstrap-admin] requireEmailVerification=${requireEmailVerification}, will set emailVerified=${!requireEmailVerification}`
    )

    // Create admin user via Better Auth API
    const { alreadyExists, userId } = yield* createAdminUser(auth, config, requireEmailVerification)

    if (alreadyExists) {
      yield* Console.log(`⏩ Admin bootstrap skipped: User ${config.email} already exists`)
      return
    }

    yield* Console.log(`✅ Admin account created: ${config.email}`)

    // Send verification email if required
    if (requireEmailVerification && userId) {
      yield* Console.log('[bootstrap-admin] Sending verification email...')
      yield* sendAdminVerificationEmail(auth, userId, config.email)
      yield* Console.log('📧 Verification email sent to admin')
    }
  })
