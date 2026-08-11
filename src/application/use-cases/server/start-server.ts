/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
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
import { validateRequiredEnvVars } from '@/application/use-cases/env/validate-required-env-vars'
import {
  validateTelemetryConfiguration,
  type TelemetryConfigurationError,
} from '@/application/use-cases/env/validate-telemetry-configuration'
import { decodeAppConfigObject } from '@/application/use-cases/schema/decode-app-config'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { TypeScriptValidator } from '@/infrastructure/automations/typescript-validator'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { BootstrapTokenRepositoryLive } from '@/infrastructure/database/repositories/auth/bootstrap-token-repository-live'
import { Logger } from '@/infrastructure/logging/logger'
import { activateTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import { getSovriumVersion } from '@/infrastructure/utils/version'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { ServerInstance } from '@/application/models/server'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/infrastructure/auth/better-auth'
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
 * Determine whether the auth.user table holds any HUMAN (sign-in-capable)
 * user. Returns false on any error (DATABASE_URL unset, network blip) so the
 * boot continues without forcing a bootstrap-token print.
 *
 * Delegates the count to `AuthRepository.countHumanUsers`, which counts only
 * users backed by an `auth.account` row — an INNER JOIN excludes synthetic
 * `type='agent'` service identities, which carry no account and cannot sign in.
 * Without that, an app declaring `app.agents[]` would have a non-empty
 * `auth.user` table at boot purely from its agent users, suppressing the
 * no-config first-admin bootstrap token even though no real admin was ever
 * provisioned.
 */
const userTableIsEmpty = (): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return (yield* repo.countHumanUsers()) === 0
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    Effect.catchAll(() => Effect.succeed(false))
  )

/**
 * Generate a one-time bootstrap token at boot when applicable, and
 * RETURN the plaintext so the caller can fold it into the clean startup
 * banner (no separator-bar block, no separate `[INFO]` log line — the
 * banner is the single canonical surface).
 *
 * Returns `undefined` when no token was generated (env-var bootstrap is in
 * play, a user already exists, or no auth is configured).
 */
const runBootstrapTokenFlow = (
  app: Readonly<{ readonly auth?: unknown }>
): Effect.Effect<string | undefined, BootstrapTokenBootError, never> =>
  Effect.gen(function* () {
    // No auth configured → no admin to bootstrap → skip silently.
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
 * Run startup-time validation for `code` actions: TypeScript body
 * type-check. Extracted from `startServer` so the outer Effect.gen
 * stays under the per-function line cap.
 */
const validateCodeActionsAtStartup = (
  validatedApp: unknown
): Effect.Effect<void, TSValidationError, TypeScriptValidator> =>
  Effect.gen(function* () {
    const tsValidator = yield* TypeScriptValidator
    yield* tsValidator.validateAll(validatedApp)
  })

/**
 * Run the raw config through the shared decode pipeline.
 *
 * Boot decodes the config exactly the way `sovrium validate` and `sovrium
 * build` do — same normalization, same cross-table foreign-key rule, and the
 * same refusal of a property AppSchema does not declare — so a config the
 * validator accepts is a config this boots, and one it rejects never reaches a
 * listening socket. No policy is passed: the shared decoder's
 * `onExcessProperty: 'error'` default IS the contract. See
 * `decode-app-config.ts`.
 */
const decodeAndValidateApp = (app: unknown): Effect.Effect<App, AppValidationError, never> =>
  Effect.suspend(() => {
    const decoded = decodeAppConfigObject(app)
    return decoded.valid
      ? Effect.succeed(decoded.app)
      : Effect.fail(new AppValidationError(decoded.errors.join('\n')))
  })

/**
 * Format a bootstrap-admin failure for the warning log. `BootstrapDatabaseError`
 * carries the real failure on `.cause`; the tagged error's own `.message`
 * is empty — surface the cause so a bootstrap failure stays diagnosable.
 */
const formatBootstrapError = (
  error: Readonly<{ readonly _tag?: string; readonly message: string; readonly cause?: unknown }>
): string =>
  '_tag' in error && error._tag === 'BootstrapDatabaseError'
    ? error.cause instanceof Error
      ? error.cause.message
      : String(error.cause)
    : error.message

/**
 * Run migrations and bootstrap the admin (env-var or no-config-token).
 * Extracted from `startServer` so the outer Effect.gen stays under the
 * per-function line cap. Ordering rationale — migrations must come before
 * bootstrap (createUser needs the tables), bootstrap must come before
 * `serverFactory.create` (the create call binds the listener and prints
 * "Server ready").
 *
 * Returns the plaintext bootstrap token when one was freshly generated,
 * otherwise `undefined`. The caller threads this through to
 * `serverFactory.create` so the token surfaces in the startup banner.
 */
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
    return yield* bootstrapAdminAndToken(validatedApp, logger)
  })

/**
 * Bootstrap the admin account and (when applicable) generate a no-config
 * bootstrap token before the listener binds. Both branches are non-fatal —
 * failures are logged and startup continues so operators can recover via
 * env-var overrides without manual intervention.
 *
 * Returns the plaintext bootstrap token when one was freshly generated this
 * boot, otherwise `undefined`. The caller is responsible for handing the
 * token to `serverFactory.create` so it surfaces in the clean startup banner
 * (renderStartupSummary). Token-generation failure resolves to `undefined`.
 */
const bootstrapAdminAndToken = (
  validatedApp: App,
  logger: Context.Tag.Service<typeof Logger>
): Effect.Effect<string | undefined, never, AuthRepository | Auth> =>
  Effect.gen(function* () {
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catchAll((error) =>
        logger.warn(`Admin bootstrap error: ${formatBootstrapError(error)}`)
      )
    )
    return yield* runBootstrapTokenFlow(validatedApp).pipe(
      Effect.catchAll((error) => {
        const { cause } = error
        const message = cause instanceof Error ? cause.message : String(cause)
        return Effect.zipRight(
          logger.warn(`Bootstrap token generation skipped: ${message}`),
          // Resolve to `undefined` (not `Effect.void`) so this recovery branch
          // matches `runBootstrapTokenFlow`'s `string | undefined` success type —
          // the happy path returns a token string. effect(effectSucceedWithVoid)
          // is a false positive here: the value participates in a `string | undefined`
          // union, it is not a throwaway void.
          Effect.succeed(undefined)
        )
      })
    )
  })

/**
 * Render-service handles threaded into `serverFactory.create`. Bundled so the
 * create call lives in `createServerInstance` (keeping `startServer`'s body
 * under the per-function line cap).
 */
interface CreateServerDeps {
  readonly serverFactory: Context.Tag.Service<typeof ServerFactory>
  readonly pageRenderer: Context.Tag.Service<typeof PageRenderer>
  readonly bootstrapToken: string | undefined
}

/**
 * Create the server from the validated app and the threaded render services.
 */
const createServerInstance = (
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
  return deps.serverFactory.create({
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
}

export const startServer = (
  app: unknown,
  options: StartOptions = {}
): Effect.Effect<
  ServerInstance,
  | AppValidationError
  | MissingRequiredEnvVarError
  | TelemetryConfigurationError
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | TSValidationError
  | Error,
  | ServerFactory
  | PageRenderer
  | Auth
  | AuthRepository
  | Logger
  | StorageService
  | TypeScriptValidator
> =>
  Effect.gen(function* () {
    const validatedApp = yield* decodeAndValidateApp(app)
    yield* validateRequiredEnvVars(validatedApp.env, process.env)
    // No encryption-key gate here any more. A server used to refuse to boot
    // without `SOVRIUM_ENCRYPTION_KEY`; it now runs on a key it provisions for
    // itself (`infrastructure/crypto/root-secret.ts`), resolved at the composition
    // root before any consumer derives from it...009.
    // Telemetry (observability-export) gate validation: unset → silently off,
    // set-but-malformed (bad SENTRY_DSN / out-of-range SENTRY_TRACES_SAMPLE_RATE)
    // → boot aborts loudly before the port binds. See [internal ref]-*.
    yield* validateTelemetryConfiguration(process.env)
    // Activate the enabled telemetry signals ONCE (error reporter + crash
    // handlers; the OTLP log runtime is wired here in a later step). A no-op
    // when no gate variable is set.
    const telemetryVersion = yield* Effect.promise(() => getSovriumVersion())
    yield* Effect.sync(() =>
      activateTelemetry({ appName: validatedApp.name, version: telemetryVersion })
    )
    // AI configuration gate: reject AI fields / agents when AI_PROVIDER is
    // unset, and reject unrecognised AI_PROVIDER values — both surface as
    // operator-facing startup errors rather than silent no-ops or crashes.
    yield* validateAiConfiguration(validatedApp, process.env)
    // Eco-conception routing gate: ECO_AI_PROVIDER_PRECEDENCE=local-only refuses
    // to start without a reachable local Ollama (no cloud fall-back permitted).
    yield* validateEcoAiRouting(process.env, probeOllamaReachable)
    // Type-check every runTypescript body BEFORE the listener binds
    // (a misconfig must surface at boot, not on hit).
    yield* validateCodeActionsAtStartup(validatedApp)
    yield* StorageService // triggers S3 bucket accessibility check
    const serverFactory = yield* ServerFactory
    const pageRenderer = yield* PageRenderer
    const logger = yield* Logger

    // Run migrations → config-file version seed → admin bootstrap before
    // `serverFactory.create` (which binds the listener). See
    // `runBootSequenceAndBootstrap` for the full ordering rationale.
    const bootstrapToken = yield* runBootSequenceAndBootstrap(validatedApp, logger)

    return yield* createServerInstance(validatedApp, options, {
      serverFactory,
      pageRenderer,
      bootstrapToken,
    })
  })
