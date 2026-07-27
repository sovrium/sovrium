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

export class InvalidEmailError extends Data.TaggedError('InvalidEmailError')<{
  readonly email: string
}> {}

export class WeakPasswordError extends Data.TaggedError('WeakPasswordError')<{
  readonly message: string
}> {}

export class BootstrapDatabaseError extends Data.TaggedError('BootstrapDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AdminBootstrapConfig {
  readonly email: string
  readonly password: string
  readonly name: string
  readonly role?: string
}

export const parseAdminBootstrapConfig = (): AdminBootstrapConfig | undefined => {
  const email = process.env.AUTH_ADMIN_EMAIL
  const password = process.env.AUTH_ADMIN_PASSWORD
  const name = process.env.AUTH_ADMIN_NAME
  const role = process.env.AUTH_ADMIN_ROLE

  if (!email || !password) {
    return undefined
  }

  return { email, password, name: name || 'Administrator', role: role || 'admin' }
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
  BootstrapDatabaseError | AuthDatabaseError,
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
            role: (config.role ?? 'admin') as 'admin',
          },
        })

        return userResult
      },
      catch: (error) => new BootstrapDatabaseError({ cause: error }),
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

const checkBootstrapPreconditions = (
  app: App,
  config: AdminBootstrapConfig | undefined
): Effect.Effect<AdminBootstrapConfig | undefined, never> =>
  Effect.sync(() => {
    if (!config) {
      logDebug('[bootstrap-admin] no admin bootstrap config — skipping')
      return undefined
    }

    if (!app.auth) {
      logDebug('[bootstrap-admin] auth not configured — skipping')
      return undefined
    }

    return config
  })

const handlePostCreation = (
  requireEmailVerification: boolean,
  userId: string | undefined
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (requireEmailVerification && userId) {
      logDebug('[bootstrap-admin] verification email required for new admin')
    }
  })

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
