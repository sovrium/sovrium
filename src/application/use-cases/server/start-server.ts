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
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { PackageResolver } from '@/infrastructure/automations/package-resolver'
import { TypeScriptValidator } from '@/infrastructure/automations/typescript-validator'
import { db } from '@/infrastructure/database'
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
import type { Context } from 'effect'

/**
 * Server configuration options
 */
export interface StartOptions {
  /**
   * Port number for the HTTP server
   * @default 3000
   */
  readonly port?: number

  /**
   * Hostname to bind the server to
   * @default "localhost"
   */
  readonly hostname?: string

  /**
   * Directory to serve static files from during development
   * Files are served at their relative path (e.g., `publicDir/logos/x.png` → `/logos/x.png`)
   */
  readonly publicDir?: string

  /**
   * Hash of the configuration content for change detection
   */
  readonly configHash?: string

  /**
   * Path to the configuration file for restart/reload
   */
  readonly configPath?: string
}

/**
 * Tagged error for the boot-time bootstrap-token flow. We wrap any
 * downstream cause in `cause` so the catch site can pretty-print it
 * without losing the original.
 */
class BootstrapTokenBootError extends Data.TaggedError('BootstrapTokenBootError')<{
  readonly cause: unknown
}> {}

/**
 * Determine whether the auth.user table is empty. Returns false on any
 * error (DATABASE_URL unset, network blip) so the boot continues
 * without forcing a bootstrap-token print.
 */
const userTableIsEmpty = (): Effect.Effect<boolean, never> =>
  Effect.tryPromise({
    try: async () => {
      const rows = await db.select({ value: count() }).from(users)
      const userCount = Number(rows[0]?.value ?? 0)
      return userCount === 0
    },
    catch: (cause) => new BootstrapTokenBootError({ cause }),
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))

/**
 * Generate a one-time bootstrap token at boot when applicable, and
 * print the plaintext to stdout EXACTLY ONCE so the operator can
 * claim the first admin via `POST /api/admin/bootstrap/claim`.
 */
const runBootstrapTokenFlow = (
  app: Readonly<{ readonly auth?: unknown }>,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<void, BootstrapTokenBootError, never> =>
  Effect.gen(function* () {
    // No auth configured → no admin to bootstrap → skip silently.
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

/**
 * Print the one-time bootstrap token banner to stdout. Extracted into
 * its own function so `runBootstrapTokenFlow` stays under the
 * `max-lines-per-function` ceiling.
 *
 * Plaintext is shown EXACTLY ONCE on the stdout stream, NOT through the
 * structured logger — the latter persists log lines and we explicitly
 * do not want this token in any retained log.
 */
const printBootstrapBanner = (plaintext: string): void => {
  // eslint-disable-next-line no-console -- Bootstrap token must reach stdout exactly once and bypass the persistent logger by design (see function header)
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

/**
 * Use case for starting an Sovrium web server
 *
 * This orchestrates the server startup process:
 * 1. Validates the app configuration using Effect Schema
 * 2. Obtains rendering and server creation services via Effect Context
 * 3. Creates and starts the server via injected dependencies
 * 4. Bootstraps admin account if configured via environment variables
 *
 * Dependencies are provided via Effect.provide(AppLayer) at the application boundary.
 *
 * @param app - Application configuration
 * @param options - Server configuration options
 * @returns Effect that yields ServerInstance or errors
 *
 * @example
 * ```typescript
 * // In CLI start command
 * const program = startServer(appConfig, { port: 3000 }).pipe(
 *   Effect.provide(AppLayer)
 * )
 * ```
 */
/**
 * Run startup-time validation for `code` actions: package resolution
 * + TypeScript body type-check. Extracted from `startServer` so the
 * outer Effect.gen stays under the per-function line cap.
 */
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

/**
 * Validate the raw config against trigger + schema rules. Surfaces
 * trigger-shape errors first (cleaner messages) and the full
 * AppSchema decoder second.
 */
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

/**
 * Bootstrap the admin account and (when applicable) generate a no-config
 * bootstrap token before the listener binds. Both branches are non-fatal —
 * failures are logged and startup continues so operators can recover via
 * env-var overrides without manual intervention.
 */
const bootstrapAdminAndToken = (
  validatedApp: App,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<void, never, AuthRepository | Auth> =>
  Effect.gen(function* () {
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catchAll((error) => logger.warn('Admin bootstrap error', error.message))
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
    // AI configuration gate: reject AI fields / agents when AI_PROVIDER is
    // unset, and reject unrecognised AI_PROVIDER values — both surface as
    // operator-facing startup errors rather than silent no-ops or crashes.
    yield* validateAiConfiguration(validatedApp, process.env)
    // Eco-conception routing gate: ECO_AI_PROVIDER_PRECEDENCE=local-only refuses
    // to start without a reachable local Ollama (no cloud fall-back permitted).
    yield* validateEcoAiRouting(process.env, probeOllamaReachable)
    // Resolve npm packages + type-check every runTypescript body BEFORE
    // the listener binds (misconfig must surface at boot, not on hit).
    yield* validateCodeActionsAtStartup(validatedApp)
    yield* StorageService // triggers S3 bucket accessibility check
    const serverFactory = yield* ServerFactory
    const pageRenderer = yield* PageRenderer
    const logger = yield* Logger
    // Admin + no-config bootstrap-token flow. Both are non-fatal so the
    // server still binds when, e.g., the admin row already exists.
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
