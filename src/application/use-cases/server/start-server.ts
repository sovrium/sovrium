/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { countDistinct, eq } from 'drizzle-orm'
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
import { validateCloudGate } from '@/application/use-cases/automations/validate-cloud-gate'
import { validateTriggerConfigs } from '@/application/use-cases/automations/validate-trigger-configs'
import { validateRequiredEnvVars } from '@/application/use-cases/env/validate-required-env-vars'
import { normalizeAppConfig } from '@/application/use-cases/server/normalize-app-config'
import { AppSchema } from '@/domain/models/app'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { PackageResolver } from '@/infrastructure/automations/package-resolver'
import { TypeScriptValidator } from '@/infrastructure/automations/typescript-validator'
import { installHostLogDrain } from '@/infrastructure/cloud/log-drain'
import { installHostMetricsCollector } from '@/infrastructure/cloud/metrics-collector'
import { db } from '@/infrastructure/database'
import { authUsersTable, authAccountsTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { BootstrapTokenRepositoryLive } from '@/infrastructure/database/repositories/auth/bootstrap-token-repository-live'
import { ensureCloudIngressRoutesTable } from '@/infrastructure/database/repositories/cloud/cloud-ingress-repository-live'
import { Logger } from '@/infrastructure/logging/logger'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { ServerInstance } from '@/application/models/server'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/infrastructure/auth/better-auth'
import type { PackageResolutionError } from '@/infrastructure/automations/package-resolver'
import type { TSValidationError } from '@/infrastructure/automations/typescript-validator'
import type {
  DatabaseConnectionError,
  MigrationError,
} from '@/infrastructure/database/drizzle/migrate'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
import type { Context } from 'effect'

const isCloudModeEnabled = (): boolean => {
  const flag = process.env.SOVRIUM_CLOUD_MODE
  return typeof flag === 'string' && flag.trim().length > 0
}

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
      const users = authUsersTable()
      const accounts = authAccountsTable()
      const rows = await db
        .select({ value: countDistinct(users.id) })
        .from(users)
        .innerJoin(accounts, eq(accounts.userId, users.id))
      const userCount = Number(rows[0]?.value ?? 0)
      return userCount === 0
    },
    catch: (cause) => new BootstrapTokenBootError({ cause }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

const runBootstrapTokenFlow = (
  app: Readonly<{ readonly auth?: unknown }>
): Effect.Effect<string | undefined, BootstrapTokenBootError, never> =>
  Effect.gen(function* () {
    if (!app.auth) return undefined

    const empty = yield* userTableIsEmpty()
    const ctx: BootstrapTokenBootContext = {
      hasAuthAdminEmailEnv: Boolean(process.env.AUTH_ADMIN_EMAIL),
      userTableIsEmpty: empty,
    }

    const result = yield* generateBootstrapTokenIfNeeded(ctx).pipe(
      Effect.provide(BootstrapTokenRepositoryLive),
      Effect.mapError((cause) => new BootstrapTokenBootError({ cause }))
    )

    return result.kind === 'generated' ? result.plaintext : undefined
  })

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
    yield* validateCloudGate(normalizedApp)
    return yield* Schema.decodeUnknown(AppSchema)(normalizedApp).pipe(
      Effect.mapError((error) => new AppValidationError(error))
    )
  })

const formatBootstrapError = (
  error: Readonly<{ readonly _tag?: string; readonly message: string; readonly cause?: unknown }>
): string =>
  '_tag' in error && error._tag === 'DatabaseError'
    ? error.cause instanceof Error
      ? error.cause.message
      : String(error.cause)
    : error.message

const runBootSequenceAndBootstrap = (
  validatedApp: App,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<
  string | undefined,
  MigrationError | DatabaseConnectionError,
  AuthRepository | Auth
> =>
  Effect.gen(function* () {
    yield* runMigrations(parseDatabaseDialectConfig())
    if (isCloudModeEnabled()) {
      yield* Effect.promise(() => ensureCloudIngressRoutesTable().catch(() => undefined))
    }
    return yield* bootstrapAdminAndToken(validatedApp, logger)
  })

const bootstrapAdminAndToken = (
  validatedApp: App,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<string | undefined, never, AuthRepository | Auth> =>
  Effect.gen(function* () {
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catchAll((error) => logger.warn('Admin bootstrap error', formatBootstrapError(error)))
    )
    return yield* runBootstrapTokenFlow(validatedApp).pipe(
      Effect.catchAll((error) => {
        const { cause } = error
        const message = cause instanceof Error ? cause.message : String(cause)
        return Effect.zipRight(
          logger.warn('Bootstrap token generation skipped', message),
          Effect.succeed(undefined)
        )
      })
    )
  })

interface CreateServerDeps {
  readonly serverFactory: Context.Tag.Service<typeof ServerFactory>
  readonly pageRenderer: Context.Tag.Service<typeof PageRenderer>
  readonly bootstrapToken: string | undefined
}

const createServerWithDrain = (
  validatedApp: App,
  options: StartOptions,
  deps: CreateServerDeps
): Effect.Effect<
  ServerInstance,
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | Error,
  never
> => {
  const create = deps.serverFactory.create({
    app: validatedApp,
    port: options.port,
    hostname: options.hostname,
    publicDir: options.publicDir,
    configHash: options.configHash,
    configPath: options.configPath,
    renderPage: deps.pageRenderer.renderPage,
    renderNotFoundPage: deps.pageRenderer.renderNotFound,
    renderErrorPage: deps.pageRenderer.renderError,
    renderRssFeed: deps.pageRenderer.renderRssFeed,
    bootstrapToken: deps.bootstrapToken,
  })
  return isCloudModeEnabled()
    ? create.pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            installHostLogDrain(validatedApp)
            installHostMetricsCollector(validatedApp)
          })
        )
      )
    : create
}

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

    const bootstrapToken = yield* runBootSequenceAndBootstrap(validatedApp, logger)

    return yield* createServerWithDrain(validatedApp, options, {
      serverFactory,
      pageRenderer,
      bootstrapToken,
    })
  })
