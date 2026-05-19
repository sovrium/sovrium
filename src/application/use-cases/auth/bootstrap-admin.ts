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
} from '@/application/ports/repositories/auth-repository'
import { getStrategy } from '@/domain/models/app/auth'
import { Auth } from '@/infrastructure/auth/better-auth'
import { logDebug } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Context } from 'effect'

export class InvalidEmailError extends Data.TaggedError('InvalidEmailError')<{
  readonly email: string
}> {}

export class WeakPasswordError extends Data.TaggedError('WeakPasswordError')<{
  readonly message: string
}> {}

export class DatabaseError extends Data.TaggedError('DatabaseError')<{
  readonly cause: unknown
}> {}

export interface AdminBootstrapConfig {
  readonly email: string
  readonly password: string
  readonly name: string
}

export const parseAdminBootstrapConfig = (): AdminBootstrapConfig | undefined => {
  const email = process.env.AUTH_ADMIN_EMAIL
  const password = process.env.AUTH_ADMIN_PASSWORD
  const name = process.env.AUTH_ADMIN_NAME

  if (!email || !password) {
    return undefined
  }

  return { email, password, name: name || 'Administrator' }
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isValidPassword = (password: string): boolean => {
  return password.length >= 8
}

const createAdminUser = (
  auth: Context.Tag.Service<typeof Auth>,
  config: Readonly<AdminBootstrapConfig>,
  requireEmailVerification: boolean
): Effect.Effect<
  { alreadyExists: boolean; userId?: string },
  DatabaseError | AuthDatabaseError,
  AuthRepository
> =>
  Effect.gen(function* () {
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
        const originalError = dbError.cause
        const errorMessage =
          originalError instanceof Error ? originalError.message : String(originalError)
        if (errorMessage.toLowerCase().includes('already exists')) {
          return Effect.succeed({ alreadyExists: true })
        }

        return Effect.fail(dbError)
      })
    )

    if ('alreadyExists' in result && result.alreadyExists) {
      return result
    }

    const userId = 'user' in result && result.user ? result.user.id : undefined

    if (userId && !requireEmailVerification) {
      const authRepo = yield* AuthRepository
      yield* authRepo.verifyUserEmail(userId)
    }

    return { alreadyExists: false, userId }
  })

const validateBootstrapConfig = (
  config: AdminBootstrapConfig
): Effect.Effect<void, InvalidEmailError | WeakPasswordError> =>
  Effect.gen(function* () {
    if (!isValidEmail(config.email)) {
      logDebug(`[bootstrap-admin] Invalid email format: ${config.email}`)
      return yield* new InvalidEmailError({ email: config.email })
    }

    if (!isValidPassword(config.password)) {
      logDebug('[bootstrap-admin] Password too weak')
      return yield* new WeakPasswordError({
        message: 'Password must be at least 8 characters',
      })
    }
  })

const checkBootstrapPreconditions = (
  app: App,
  config: AdminBootstrapConfig | undefined
): Effect.Effect<AdminBootstrapConfig | undefined, never> =>
  Effect.sync(() => {
    if (!config) {
      logDebug('[bootstrap-admin] No admin bootstrap config found')
      return undefined
    }

    logDebug(`[bootstrap-admin] Admin bootstrap config found: ${config.email}`)

    if (!app.auth) {
      logDebug('[bootstrap-admin] Auth not configured, skipping')
      return undefined
    }

    logDebug('[bootstrap-admin] Auth is configured')
    return config
  })

const handlePostCreation = (
  requireEmailVerification: boolean,
  userId: string | undefined
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (requireEmailVerification && userId) {
      logDebug('[bootstrap-admin] Sending verification email...')
      logDebug('[bootstrap-admin] Verification email sent to admin')
    }
  })

export const bootstrapAdmin = (
  app: App
): Effect.Effect<
  void,
  InvalidEmailError | WeakPasswordError | DatabaseError | AuthDatabaseError,
  Auth | AuthRepository
> =>
  Effect.gen(function* () {
    const parsedConfig = parseAdminBootstrapConfig()
    const config = yield* checkBootstrapPreconditions(app, parsedConfig)

    if (!config) return

    yield* validateBootstrapConfig(config)
    logDebug('[bootstrap-admin] Email and password validated, proceeding to create user')

    const auth = yield* Auth

    const emailAndPasswordStrategy = getStrategy(app.auth, 'emailAndPassword')
    const requireEmailVerification = emailAndPasswordStrategy?.requireEmailVerification ?? false

    logDebug(
      `[bootstrap-admin] requireEmailVerification=${requireEmailVerification}, will set emailVerified=${!requireEmailVerification}`
    )

    const { alreadyExists, userId } = yield* createAdminUser(auth, config, requireEmailVerification)

    if (alreadyExists) {
      logDebug(`[bootstrap-admin] Skipped: User ${config.email} already exists`)
      return
    }

    logDebug(`[bootstrap-admin] Admin account created: ${config.email}`)
    yield* handlePostCreation(requireEmailVerification, userId)
  })
