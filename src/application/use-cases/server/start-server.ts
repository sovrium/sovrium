/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Data, Effect } from 'effect'
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
import { decodeAppConfigObject } from '@/application/use-cases/config/decode-app-config'
import { validateRequiredEnvVars } from '@/application/use-cases/env/validate-required-env-vars'
import {
  validateTelemetryConfiguration,
  type TelemetryConfigurationError,
} from '@/application/use-cases/env/validate-telemetry-configuration'
import { prebuildSearchIndex } from '@/application/use-cases/server/prebuild-search-index'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { prunePagesByRequirements } from '@/domain/models/app/pages/page-requires'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { TypeScriptValidator } from '@/infrastructure/automations/typescript-validator'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { Logger } from '@/infrastructure/logging/logger'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { activateTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { BootstrapTokenRepository } from '@/application/ports/repositories/auth/bootstrap-token-repository'
import type { CSSCompiler } from '@/application/ports/services/css-compiler'
import type { DatabaseStartupReport } from '@/application/ports/services/server-factory'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type { StaticSiteGenerator } from '@/application/ports/services/static-site-generator'
import type { App } from '@/domain/models/app'
import type { Auth } from '@/infrastructure/auth/better-auth/auth-service'
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
   * Static-asset serving was explicitly DISABLED (`--no-publicDir`, or the
   * `SOVRIUM_PUBLIC_DIR=none` sentinel) — as opposed to merely unconfigured.
   *
   * The distinction exists for exactly one consumer: the page-search index.
   * When a config declares a page-scoped `search-input` and no `publicDir` was
   * resolved, the boot allocates an ephemeral one purely to host the search
   * artifacts (see `resolveEffectivePublicDir`). An operator who asked for no
   * static assets at all must not silently get a temp directory back, so
   * "unset" and "refused" cannot collapse to the same value.
   */
  readonly publicDirOptOut?: boolean

  /**
   * Hash of the configuration content for change detection
   */
  readonly configHash?: string

  /**
   * Path to the configuration file for restart/reload
   */
  readonly configPath?: string

  /**
   * This boot is a `--watch` RELOAD rather than a first start: suppress the
   * multi-line startup banner, which the operator read seconds ago and which
   * the watcher replaces with a one-line summary.
   *
   * Deliberately NOT `silent`. That flag additionally suppresses the lock
   * file, its cleanup registration, and the `[server] listening on <url>`
   * line — the line `waitForServerPort` parses to
   * decide a server is up. A reload keeps all three and drops only the banner.
   */
  readonly reload?: boolean
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
const userTableIsEmpty = (): Effect.Effect<boolean, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return (yield* repo.countHumanUsers) === 0
  }).pipe(
    // effect-swallow: "cannot tell" must read as "not empty" — a DATABASE_URL that is unset or a network blip has to let the boot continue, and the conservative answer is the one that does NOT print a bootstrap token.
    Effect.orElseSucceed(() => false)
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
): Effect.Effect<
  string | undefined,
  BootstrapTokenBootError,
  AuthRepository | BootstrapTokenRepository
> =>
  Effect.gen(function* () {
    // No auth configured → no admin to bootstrap → skip silently.
    if (!app.auth) return undefined

    const empty = yield* userTableIsEmpty()
    const ctx: BootstrapTokenBootContext = {
      hasAuthAdminEmailEnv: Boolean(process.env.AUTH_ADMIN_EMAIL),
      userTableIsEmpty: empty,
    }

    const result = yield* generateBootstrapTokenIfNeeded(ctx).pipe(
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
 * Dependencies are declared in the returned Effect's requirement channel and
 * discharged by the composition root that owns a runtime (standing rule E1).
 *
 * @param app - Application configuration
 * @param options - Server configuration options
 * @returns Effect that yields ServerInstance or errors
 *
 * @example
 * ```typescript
 * // In the CLI start command — the composition root discharges the
 * // requirements this Effect declares.
 * const program = startServer(appConfig, { port: 3000 }).pipe(
 *   Effect.provide(createAppLayer(appConfig.auth))
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
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<
  string | undefined,
  MigrationError | DatabaseConnectionError,
  AuthRepository | BootstrapTokenRepository | Auth | Logger
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
/** "No token was generated" — the union member, not a throwaway void. */
const NO_BOOTSTRAP_TOKEN: string | undefined = undefined

const bootstrapAdminAndToken = (
  validatedApp: App,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<
  string | undefined,
  never,
  AuthRepository | BootstrapTokenRepository | Auth | Logger
> =>
  Effect.gen(function* () {
    yield* bootstrapAdmin(validatedApp).pipe(
      Effect.catch((error) => logger.warn(`Admin bootstrap error: ${formatBootstrapError(error)}`))
    )
    return yield* runBootstrapTokenFlow(validatedApp).pipe(
      Effect.catch((error) => {
        const { cause } = error
        const message = cause instanceof Error ? cause.message : String(cause)
        return Effect.andThen(
          logger.warn(`Bootstrap token generation skipped: ${message}`),
          // NOT `Effect.void`: this recovery branch must match
          // `runBootstrapTokenFlow`'s `string | undefined` success type, since the
          // happy path returns a token string. The value participates in a union,
          // it is not a throwaway void.
          Effect.succeed(NO_BOOTSTRAP_TOKEN)
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
  readonly serverFactory: Context.Service.Shape<typeof ServerFactory>
  readonly pageRenderer: Context.Service.Shape<typeof PageRenderer>
  readonly bootstrapToken: string | undefined
  /**
   * The receipt of the database startup this boot already ran, before the
   * render pass. Threaded into `create` so the server it builds reuses the
   * banner rows rather than running the chain a second time.
   */
  readonly databaseStartup: DatabaseStartupReport
}

/**
 * "No directory is served" — the union member, not a throwaway void. Named for
 * the same reason as `NO_BOOTSTRAP_TOKEN` above: it participates in a
 * `string | undefined` result, so `Effect.void` would be wrong here even though
 * it reads identically at the call site.
 */
const NO_PUBLIC_DIR: string | undefined = undefined

/**
 * Where the page-search artifacts get written, which is also what the
 * static-asset route will serve.
 *
 * Three cases. An operator-configured `publicDir` is used as-is. An explicit
 * opt-out yields nothing, and the index is skipped with it — `--no-publicDir`
 * means no static assets, search included. Otherwise, when and only when the
 * config actually declares a page-scoped `search-input`, an ephemeral directory is
 * allocated purely to host the two search files.
 *
 * The temp directory is deliberately NOT removed at shutdown. Only
 * `/sovrium-search/*` is ever written into it, so nothing else accidentally
 * becomes a static asset, and the OS reaps `/tmp` on its own (systemd-tmpfiles
 * ≥10 days on Linux, 3 days on macOS). If that ever becomes observable, the
 * place to remove it is `installShutdownHandlers`
 * (`infrastructure/server/lifecycle.ts`), which owns the whole SIGTERM/SIGINT
 * path and has nothing to race.
 */
/** The ephemeral directory that hosts the page-search artifacts could not be made. */
class SearchPublicDirError extends Data.TaggedError('SearchPublicDirError')<{
  readonly cause: unknown
}> {}

const resolveEffectivePublicDir = (
  validatedApp: App,
  options: StartOptions,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<string | undefined, never> => {
  if (options.publicDir) return Effect.succeed(options.publicDir)
  if (options.publicDirOptOut || !hasPageSearchComponent(validatedApp)) {
    return Effect.succeed(NO_PUBLIC_DIR)
  }
  return Effect.tryPromise({
    try: async () => {
      const { mkdtemp } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      return mkdtemp(join(tmpdir(), 'sovrium-search-public-'))
    },
    catch: (cause) => new SearchPublicDirError({ cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      logger.warn(`Page search disabled — no temporary directory: ${Cause.pretty(cause)}`)
    ),
    // effect-swallow: see the tap above, and `prepareSearchArtifacts` below,
    // which states the same rule: a search index that cannot be built costs
    // the operator search, never the deployment. Falling back to no public
    // directory is exactly what a config with no page search resolves to.
    Effect.orElseSucceed(() => NO_PUBLIC_DIR)
  )
}

/**
 * Emit the page-search artifacts before the listener binds, so
 * `/sovrium-search/index.json` is servable from request one, and return the
 * directory they went into — which is also what the static-asset route mounts.
 *
 * A failure NEVER takes the boot down: the static-asset route then 404s the
 * search paths, which is the same observable behaviour as a config with no
 * page-scoped search at all. The operator gets a diagnostic line and a
 * server. Losing the whole deployment over an unbuildable search index would
 * be a far worse trade than losing search.
 */
const prepareSearchArtifacts = (
  rawApp: unknown,
  validatedApp: App,
  options: StartOptions,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<
  string | undefined,
  never,
  ServerFactory | PageRenderer | CSSCompiler | StaticSiteGenerator
> =>
  Effect.gen(function* () {
    const publicDir = yield* resolveEffectivePublicDir(validatedApp, options, logger)
    if (publicDir !== undefined) {
      yield* prebuildSearchIndex(rawApp, validatedApp, publicDir).pipe(
        Effect.asVoid,
        Effect.catchCause((cause) => logger.warn(`Search index not built: ${Cause.pretty(cause)}`))
      )
    }
    return publicDir
  })

/**
 * Run the database startup chain for this process, once, before anything
 * renders.
 *
 * It used to run inside `serverFactory.create`, which made it a property of a
 * SERVER rather than of a start — and a start that renders built more than one
 * server. A page-scoped `search-input` sends `prepareSearchArtifacts` through
 * the static generator, which back then asked `create` for a whole server per
 * supported language plus one for the root index, and every one of them re-ran
 * migrations, schema init, both column reconcilers, the search-index purge, the
 * seeders and the JWKS rekey survey against the operator's real database.
 * Measured at three runs for a single-language app on 2026-09-18
 *.
 *
 * The render pass creates no server now. It asks `serverFactory.buildRenderApp`
 * for an `{ app, dispose }` pair (`infrastructure/server/render-app.ts`), which
 * builds the Hono app and its domain runtime, binds no socket, and runs neither
 * process-wide chain. So the tables a `dataSource`-bound page renders against
 * exist before the pass for exactly one reason: this call ran `startDatabase`
 * first.
 *
 * That makes the ordering a PRECONDITION rather than a tidy-up, and the whole
 * reason this step is hoisted here. Move it after the render pass — or drop it
 * — and a `dataSource`-bound page renders against relations nobody migrated, on
 * precisely the boot where nobody had. [internal ref] is the
 * criterion that says so.
 *
 * The receipt travels to `create`, which reuses its banner rows so the startup
 * summary still shows the database line exactly once.
 */
const hoistDatabaseStartup = (
  serverFactory: Context.Service.Shape<typeof ServerFactory>,
  validatedApp: App
): Effect.Effect<
  DatabaseStartupReport,
  AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> => serverFactory.startDatabase(validatedApp)

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
    reload: options.reload,
    databaseStartup: deps.databaseStartup,
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
  // Boot-time first-admin bootstrap. Both reads used to bind their own layer
  // here; `createAppLayer` carries them, so `startServer` names them instead.
  | BootstrapTokenRepository
  | Logger
  | StorageService
  | TypeScriptValidator
  // Added by the page-search index step. Both are already members of
  // `createAppLayer`, so no caller had to widen what it provides — see
  // `prebuild-search-index.ts` for why that is not a coincidence.
  | CSSCompiler
  | StaticSiteGenerator
> =>
  Effect.gen(function* () {
    // G4: a page whose `requires` the app does not meet is dropped HERE, before
    // anything reads `pages` — routing, the sitemap, the palette's page list and
    // the search index all take their view of the app from this object. Gating
    // later would deliver the 404 and none of the rest, leaving the app
    // advertising URLs it refuses to serve.
    const validatedApp = prunePagesByRequirements(yield* decodeAndValidateApp(app))
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
    // effect-promise: total -- `getSovriumVersion` wraps its `package.json` read in a try/catch and falls back to the build-time define, so it always resolves a string.
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
    yield* validateEcoAiRouting(validatedApp, process.env, probeOllamaReachable)
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

    const databaseStartup = yield* hoistDatabaseStartup(serverFactory, validatedApp)

    // Page-search artifacts, before the listener binds. Used to be the CLI's
    // job, which meant every other caller of `startServer` served a 404 for
    // `/sovrium-search/*`. It is a property of the server, so it boots here.
    const publicDir = yield* prepareSearchArtifacts(app, validatedApp, options, logger)

    return yield* createServerInstance(
      validatedApp,
      { ...options, ...(publicDir !== undefined && { publicDir }) },
      { serverFactory, pageRenderer, bootstrapToken, databaseStartup }
    )
  }).pipe(Effect.withSpan('server.start-server'))
