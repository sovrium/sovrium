/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Console, Data } from 'effect'
import { Auth } from '@/infrastructure/auth/better-auth'
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
  const email = process.env.BETTER_AUTH_ADMIN_EMAIL
  const password = process.env.BETTER_AUTH_ADMIN_PASSWORD
  const name = process.env.BETTER_AUTH_ADMIN_NAME

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
 * Uses Better Auth's signUpEmail API directly for server-side user creation.
 * Handles idempotency by checking for duplicate email errors.
 *
 * IMPORTANT: We use auth.api.signUpEmail instead of:
 * 1. auth.handler - requires HTTP request context that may not work during bootstrap
 * 2. createUser (admin plugin) - requires authenticated admin (chicken-and-egg problem)
 * 3. createUser - has a bug linking accounts to wrong user (GitHub issue #5879)
 *
 * Role assignment is handled by the admin plugin's user.created hook:
 * - First user is automatically made admin (firstUserAdmin: true)
 * - Users with "admin" in email are auto-promoted to admin with emailVerified: true
 *
 * @returns Effect that yields true if user already exists, false if created
 */
const createAdminUser = (
  auth: Context.Tag.Service<typeof Auth>,
  config: Readonly<AdminBootstrapConfig>
): Effect.Effect<boolean, DatabaseError, never> =>
  Effect.gen(function* () {
    console.log('[bootstrap-admin] Creating admin user via Better Auth API:', config.email)

    // Attempt to create user
    const result = yield* Effect.tryPromise({
      try: async () => {
        const result = await auth.api.createUser({
          body: {
            email: config.email,
            password: config.password,
            name: config.name,
            role: 'admin',
          },
        })

        console.log(
          '[bootstrap-admin] Create user API result:',
          JSON.stringify(result, undefined, 2)
        )

        return result
      },
      catch: (error) => new DatabaseError({ cause: error }),
    }).pipe(
      Effect.catchAll((dbError) => {
        console.error('[bootstrap-admin] Error creating user:', dbError)
        // If user already exists, return success (idempotent behavior)
        // Check the original error cause
        const originalError = dbError.cause
        const errorMessage =
          originalError instanceof Error ? originalError.message : String(originalError)
        if (errorMessage.toLowerCase().includes('already exists')) {
          console.log('[bootstrap-admin] User already exists, skipping creation (idempotent)')
          return Effect.succeed(true)
        }

        // For other errors, re-fail with the same DatabaseError
        return Effect.fail(dbError)
      })
    )

    // Check if we got the "already exists" marker
    if (result === true) {
      return true
    }

    return false
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
): Effect.Effect<void, InvalidEmailError | WeakPasswordError | DatabaseError, Auth> =>
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

    // Create admin user via Better Auth API
    const alreadyExists = yield* createAdminUser(auth, config)

    // Log result
    yield* alreadyExists
      ? Console.log(`⏩ Admin bootstrap skipped: User ${config.email} already exists`)
      : Console.log(`✅ Admin account created: ${config.email}`)
  })
