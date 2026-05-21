/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { count } from 'drizzle-orm'
import { Data, Effect, Schema } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { StorageService } from '@/application/ports/services/storage-service'
import { validateAiConfiguration } from '@/application/use-cases/ai/validate-ai-configuration'
import { validateEcoAiRouting } from '@/application/use-cases/ai/validate-eco-ai-routing'
import { bootstrapAdmin } from '@/application/use-cases/auth/bootstrap-admin'
import {
  generateBootstrapTokenIfNeeded,
  type BootstrapTokenBootContext,
} from '@/application/use-cases/auth/bootstrap-token'
import { validateTriggerConfigs } from '@/application/use-cases/automations/validate-trigger-configs'
import { validateRequiredEnvVars } from '@/application/use-cases/env/validate-required-env-vars'
import { normalizeAppConfig } from '@/application/use-cases/server/normalize-app-config'
import { AppSchema } from '@/domain/models/app'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database-dialect'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { PackageResolver } from '@/infrastructure/automations/package-resolver'
import { TypeScriptValidator } from '@/infrastructure/automations/typescript-validator'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { BootstrapTokenRepositoryLive } from '@/infrastructure/database/repositories/bootstrap-token-repository-live'
import { Logger } from '@/infrastructure/logging/logger'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { ServerInstance } from '@/application/models/server'
import type { AuthRepository } from '@/application/ports/repositories/auth-repository'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/infrastructure/auth/better-auth'
import type { PackageResolutionError } from '@/infrastructure/automations/package-resolver'
import type { TSValidationError } from '@/infrastructure/automations/typescript-validator'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
import type { Context } from 'effect'

export interface StartOptions {
  readonly port?: number

  readonly hostname?: string

  readonly publicDir?: string

  readonly configHash?: string

  readonly configPath?: string
}

class BootstrapTokenBootError extends Data.TaggedError('BootstrapTokenBootError')<{
  readonly cause: unknown
}> {}

const userTableIsEmpty = (): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db.select({ value: count() }).from(authUsersTable())
      const userCount = Number(rows[0]?.value ?? 0)
      return userCount === 0
    },
    catch: (cause) => new BootstrapTokenBootError({ cause }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

const runBootstrapTokenFlow = (
  app: Readonly<{ readonly auth?: unknown }>,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<void, BootstrapTokenBootError, never> =>
  Effect.gen(function* () {
    if (!app.auth) return

    const empty = yield* userTableIsEmpty()
    const ctx: BootstrapTokenBootContext = {
      hasAuthAdminEmailEnv: Boolean(process.env.AUTH_ADMIN_EMAIL),
      userTableIsEmpty: empty,
    }

    const result = yield* generateBootstrapTokenIfNeeded(ctx).pipe(
      Effect.provide(BootstrapTokenRepositoryLive),
      Effect.mapError((cause) => new BootstrapTokenBootError({ cause }))
    )

    if (result.kind === 'generated') {
      printBootstrapBanner(result.plaintext)
      yield* logger.info(
        'Bootstrap token generated (plaintext printed to stdout). It expires in 1 hour and can be claimed once.'
      )
    }
  })

const printBootstrapBanner = (plaintext: string): void => {
  console.log(
    [
      '',
      '==============================================================',
      '  SOVRIUM BOOTSTRAP TOKEN (one-time, expires in 1 hour)',
      '',
      `  ${plaintext}`,
      '',
      '  Use it once via:',
      '    POST /api/admin/bootstrap/claim',
      '    Authorization: Bearer <token>',
      '    Body: { "email", "password", "name" }',
      '==============================================================',
      '',
    ].join('\n')
  )
}

const validateCodeActionsAtStartup = (
  validatedApp: unknown
): Effect.Effect<
  void,
  PackageResolutionError | TSValidationError,
  PackageResolver | TypeScriptValidator
> =>
  Effect.gen(function* () {
    const packageResolver = yield* PackageResolver
    yield* packageResolver.resolveAll(validatedApp)
    const tsValidator = yield* TypeScriptValidator
    yield* tsValidator.validateAll(validatedApp)
  })

const decodeAndValidateApp = (
  normalizedApp: unknown
): Effect.Effect<App, AppValidationError, never> =>
  Effect.gen(function* () {
    yield* validateTriggerConfigs(normalizedApp).pipe(
      Effect.mapError((error) => new AppValidationError(error))
    )
    return yield* Schema.decodeUnknown(AppSchema)(normalizedApp).pipe(
      Effect.mapError((error) => new AppValidationError(error))
    )
  })

const bootstrapAdminAndToken = (
  validatedApp: App,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<void, never, AuthRepository | Auth> =>
  Effect.gen(function* () {
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catchAll((error) => {
        const detail =
          '_tag' in error && error._tag === 'DatabaseError'
            ? error.cause instanceof Error
              ? error.cause.message
              : String(error.cause)
            : error.message
        return logger.warn('Admin bootstrap error', detail)
      })
    )
    yield* runBootstrapTokenFlow(validatedApp, logger).pipe(
      Effect.catchAll((error) => {
        const { cause } = error
        const message = cause instanceof Error ? cause.message : String(cause)
        return logger.warn('Bootstrap token generation skipped', message)
      })
    )
  })

export const startServer = (
  app: unknown,
  options: StartOptions = {}
): Effect.Effect<
  ServerInstance,
  | AppValidationError
  | MissingRequiredEnvVarError
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | PackageResolutionError
  | TSValidationError
  | Error,
  | ServerFactory
  | PageRenderer
  | Auth
  | AuthRepository
  | Logger
  | StorageService
  | PackageResolver
  | TypeScriptValidator
> =>
  Effect.gen(function* () {
    const validatedApp = yield* decodeAndValidateApp(normalizeAppConfig(app))
    yield* validateRequiredEnvVars(validatedApp.env, process.env)
    yield* validateAiConfiguration(validatedApp, process.env)
    yield* validateEcoAiRouting(process.env, probeOllamaReachable)
    yield* validateCodeActionsAtStartup(validatedApp)
    yield* StorageService
    const serverFactory = yield* ServerFactory
    const pageRenderer = yield* PageRenderer
    const logger = yield* Logger

    yield* runMigrations(parseDatabaseDialectConfig())

    yield* bootstrapAdminAndToken(validatedApp, logger)

    return yield* serverFactory.create({
      app: validatedApp,
      port: options.port,
      hostname: options.hostname,
      publicDir: options.publicDir,
      configHash: options.configHash,
      configPath: options.configPath,
      renderPage: pageRenderer.renderPage,
      renderNotFoundPage: pageRenderer.renderNotFound,
      renderErrorPage: pageRenderer.renderError,
      renderRssFeed: pageRenderer.renderRssFeed,
    })
  })
