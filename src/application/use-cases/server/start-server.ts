/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Data, Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { InvalidEnvVarError } from '@/application/errors/invalid-env-var-error'
import { InvalidOperatorTimezoneError } from '@/application/errors/invalid-operator-timezone-error'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { StorageService } from '@/application/ports/services/storage-service'
import { validateAiConfiguration } from '@/application/use-cases/ai/validate-ai-configuration'
import { validateEcoAiRouting } from '@/application/use-cases/ai/validate-eco-ai-routing'
import {
  BootstrapDatabaseError,
  bootstrapAdmin,
  describeBootstrapDatabaseError,
} from '@/application/use-cases/auth/bootstrap-admin'
import {
  generateBootstrapTokenIfNeeded,
  type BootstrapTokenBootContext,
} from '@/application/use-cases/auth/bootstrap-token'
import { reapInterruptedRuns } from '@/application/use-cases/automations/reap-interrupted-runs'
import { decodeAppConfigObject } from '@/application/use-cases/config/decode-app-config'
import { validateRequiredEnvVars } from '@/application/use-cases/env/validate-required-env-vars'
import {
  validateTelemetryConfiguration,
  type TelemetryConfigurationError,
} from '@/application/use-cases/env/validate-telemetry-configuration'
import { prebuildSearchIndex } from '@/application/use-cases/server/prebuild-search-index'
import { ENGINE_KEY_UNPREFIXED_TOKEN } from '@/domain/models/app/languages/engine-key-prefix-validation'
import { hasPageSearchComponent } from '@/domain/models/app/pages/has-page-search'
import { prunePagesByRequirements } from '@/domain/models/app/pages/page-requires'
import { parseApiIpRateLimit } from '@/domain/models/process-env/api-ip-rate-limit'
import { parseSovriumAutomationDefaultTimeoutMs } from '@/domain/models/process-env/automations'
import { searchIndexDir, searchIndexRoot } from '@/domain/models/process-env/data-dir'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { parseSovriumDevClock } from '@/domain/models/process-env/dev-clock'
import {
  parseSovriumAutomationAutopause,
  parseSovriumNotifyAutomations,
  parseSovriumNotifyDigest,
  parseSovriumNotifyDigestCron,
  parseSovriumNotifyTo,
} from '@/domain/models/process-env/notifications'
import { parseRateLimitWindowSeconds } from '@/domain/models/process-env/rate-limit-window'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import { probeOllamaReachable } from '@/infrastructure/ai/ollama-reachability'
import { TypeScriptValidator } from '@/infrastructure/automations/typescript-validator'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { Logger } from '@/infrastructure/logging/logger'
import { publishServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { activateTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import type { MissingRequiredEnvVarError } from '@/application/errors/missing-required-env-var-error'
import type { BootstrapTokenRepository } from '@/application/ports/repositories/auth/bootstrap-token-repository'
import type { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { CSSCompiler } from '@/application/ports/services/css-compiler'
import type { DatabaseStartupReport } from '@/application/ports/services/server-factory'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type { StaticSiteGenerator } from '@/application/ports/services/static-site-generator'
import type { App } from '@/domain/models/app'
import type { AuthoredTableIds } from '@/domain/models/app/tables/authored-table-ids-service'
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
   * The distinction exists for exactly one consumer: the page-search index,
   * which is built under the data directory and served at `/sovrium-search/*`
   * whenever the config declares a page-scoped `search-input` (see
   * `prepareSearchArtifacts`). An operator who asked for no static assets at
   * all gets no search either, so "unset" and "refused" cannot collapse to
   * the same value.
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
 * The boot-time environment gates that need nothing but the environment and the
 * decoded config: every `required` app env var is present, and the operator
 * timezone names a real zone.
 *
 * The timezone gate is here because every boundary re-reads `SOVRIUM_TIMEZONE`
 * (cron registration, formatters, retention sweeps): an unknown zone must stop
 * the boot before the port binds, naming the variable and the value, rather
 * than surface later inside a scheduler or a response.
 *
 * The operator-email variables are here for the same reason: a mistyped
 * kill switch or recipient would otherwise be discovered only when an alert
 * failed to arrive. So is the default run timeout of an automation, which would
 * otherwise be discovered only when a run was stopped, the per-address API
 * ceiling, which would otherwise be discovered only when users were refused,
 * and the rate-limit window, whose bad value would switch every limit off.
 */
/** What {@link validateBootEnvironment} refuses a boot with. */
type BootEnvironmentError =
  MissingRequiredEnvVarError | InvalidOperatorTimezoneError | InvalidEnvVarError

const validateBootEnvironment = (validatedApp: App): Effect.Effect<void, BootEnvironmentError> =>
  validateRequiredEnvVars(validatedApp.env, process.env).pipe(
    Effect.andThen(
      Effect.try({
        try: () => parseSovriumTimezone(process.env),
        catch: (error) => new InvalidOperatorTimezoneError(error),
      })
    ),
    Effect.andThen(
      Effect.try({
        try: () => [
          parseSovriumNotifyAutomations(process.env),
          parseSovriumNotifyTo(process.env),
          parseSovriumAutomationAutopause(process.env),
          parseSovriumNotifyDigest(process.env),
          parseSovriumNotifyDigestCron(process.env),
          parseSovriumAutomationDefaultTimeoutMs(process.env),
          parseApiIpRateLimit(process.env),
          parseRateLimitWindowSeconds(process.env),
          parseSovriumDevClock(process.env),
        ],
        catch: (error) => new InvalidEnvVarError(error),
      })
    ),
    Effect.asVoid
  )

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
const decodeAndValidateApp = (
  app: unknown
): Effect.Effect<
  {
    readonly app: App
    readonly authoredTableIds: AuthoredTableIds
    readonly bootNotices: readonly string[]
  },
  AppValidationError,
  never
> =>
  Effect.suspend(() => {
    const decoded = decodeAppConfigObject(app)
    return decoded.valid
      ? Effect.succeed({ ...decoded, bootNotices: bootNoticesOf(decoded.notices) })
      : Effect.fail(new AppValidationError(decoded.errors.join('\n')))
  })

/**
 * The validate notices the server also prints once as it starts. Only the
 * deprecated bare engine key: the author may never run `sovrium validate`, and
 * the spelling keeps working silently otherwise. The layout notices stay
 * `validate`'s, where they are read before an edit, not on every boot.
 */
const bootNoticesOf = (notices: readonly string[]): readonly string[] =>
  notices.filter((notice) => notice.startsWith(`${ENGINE_KEY_UNPREFIXED_TOKEN}:`))

/**
 * Format a bootstrap-admin failure for the warning log. `BootstrapDatabaseError`
 * carries the real failure on `.cause`; the tagged error's own `.message`
 * is empty — surface the cause so a bootstrap failure stays diagnosable.
 */
const formatBootstrapError = (error: Readonly<{ readonly message: string }>): string =>
  error instanceof BootstrapDatabaseError ? describeBootstrapDatabaseError(error) : error.message

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
  AuthRepository | AutomationRunOutcomeRepository | BootstrapTokenRepository | Auth | Logger
> =>
  Effect.gen(function* () {
    // The instant every run of THIS server postdates, published before anything
    // can start a run, so the sweep below and its on-demand trigger route read
    // the same boundary.
    const bootedAt = publishServerBootInstant()
    yield* runMigrations(parseDatabaseDialectConfig())
    const bootstrapToken = yield* bootstrapAdminAndToken(validatedApp, logger)
    // After the admin bootstrap, so a first boot's admin is already a recipient
    // of the interrupted-run alerts this may send.
    yield* sweepInterruptedRuns(validatedApp, logger, bootedAt)
    return bootstrapToken
  })

/**
 * Close the automation runs a previous server left `running` or `queued` —
 * rows that started before this boot, which nothing will ever finish because
 * the queues they waited in died with that server — and alert each one.
 *
 * Best-effort: a sweep that cannot run costs the operator a stale "running" row
 * in the console, never the boot. The failure is logged with its cause.
 */
const sweepInterruptedRuns = (
  validatedApp: App,
  logger: Context.Service.Shape<typeof Logger>,
  bootedAt: Readonly<Date>
): Effect.Effect<void, never, AuthRepository | AutomationRunOutcomeRepository> =>
  reapInterruptedRuns(validatedApp, bootedAt).pipe(
    Effect.flatMap((closed) =>
      closed.length === 0
        ? Effect.void
        : logger.warn(
            `Closed ${closed.length} automation run(s) interrupted when the server last stopped`
          )
    ),
    Effect.tapCause((cause) =>
      logger.warn(`Interrupted-run sweep skipped: ${Cause.pretty(cause)}`)
    ),
    // effect-swallow: see the doc comment — a failed sweep never fails the boot.
    Effect.ignoreCause
  )

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

/** The page-search directory could not be prepared (mkdir, or a stale sibling removal). */
class SearchIndexDirError extends Data.TaggedError('SearchIndexDirError')<{
  readonly cause: unknown
}> {}

/** Whether a process id still names a running process. */
const isProcessAlive = (pid: number): boolean => {
  try {
    // Signal 0 checks existence without delivering anything. EPERM means the
    // process exists but belongs to another user — still alive.
    // eslint-disable-next-line functional/no-expression-statements -- existence probe, no effect
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Create this process's page-search directory under the data directory and
 * remove the ones left by processes that are no longer running, so a data
 * directory holds one index per live server rather than one per start.
 */
const prepareSearchIndexDir = (): Effect.Effect<string, SearchIndexDirError> =>
  Effect.tryPromise({
    try: async () => {
      const { mkdir, readdir, rm } = await import('node:fs/promises')
      const { join } = await import('node:path')
      const root = searchIndexRoot()
      const own = searchIndexDir()
      // eslint-disable-next-line functional/no-expression-statements -- create this process's directory
      await mkdir(own, { recursive: true })
      const entries = await readdir(root)
      // Only a directory named by a plain process id is ours to judge: a
      // `-1` or `0` would ask `kill` about a whole process group.
      const stale = entries.filter((name) => {
        const pid = Number(name)
        return /^[1-9]\d*$/.test(name) && pid !== process.pid && !isProcessAlive(pid)
      })
      // One removal at a time: a handful of dead-process directories, no pool involved.
      await stale.reduce<Promise<void>>(
        (previous, name) =>
          previous.then(() => rm(join(root, name), { recursive: true, force: true })),
        Promise.resolve()
      )
      return own
    },
    catch: (cause) => new SearchIndexDirError({ cause }),
  })

/**
 * Warn when the app's own `public/` folder ships a `sovrium-search/` directory.
 *
 * While a page declares a `search-input`, the engine owns `/sovrium-search/*`:
 * the index it builds is mounted before `public/`, so a folder of that name
 * there is never served — most often the stale copy an older version wrote
 * into it. The operator is told once, at start, so a file shipped
 * there on purpose does not vanish in silence.
 */
const warnOnShadowedPublicSearch = (
  publicDir: string | undefined,
  logger: Context.Service.Shape<typeof Logger>
): Effect.Effect<void> =>
  publicDir === undefined
    ? Effect.void
    : // effect-promise: total -- both outcomes of `access` are mapped to a boolean; nothing rejects
      Effect.promise(async () => {
        const { access } = await import('node:fs/promises')
        const { join } = await import('node:path')
        return access(join(publicDir, 'sovrium-search')).then(
          () => true,
          () => false
        )
      }).pipe(
        Effect.flatMap((shadowed) =>
          shadowed
            ? logger.warn(
                `${publicDir}/sovrium-search/ is not served: the page-search index owns /sovrium-search/*. Remove the folder, or move what it holds.`
              )
            : Effect.void
        )
      )

/**
 * Emit the page-search artifacts before the listener binds, so
 * `/sovrium-search/index.json` is servable from request one.
 *
 * They are written under the DATA directory (`searchIndexDir`), beside the
 * database — never into the app's `public/` folder, which an author commits
 * and `sovrium build` ships. The static-asset route mounts the same directory
 * for `/sovrium-search/*` only. An explicit opt-out of static assets
 * (`--no-publicDir`) still means no search, as it always did.
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
): Effect.Effect<void, never, ServerFactory | PageRenderer | CSSCompiler | StaticSiteGenerator> =>
  options.publicDirOptOut || !hasPageSearchComponent(validatedApp)
    ? Effect.void
    : Effect.gen(function* () {
        yield* warnOnShadowedPublicSearch(options.publicDir, logger)
        const dir = yield* prepareSearchIndexDir()
        yield* prebuildSearchIndex(rawApp, validatedApp, dir)
      }).pipe(
        Effect.asVoid,
        Effect.catchCause((cause) => logger.warn(`Search index not built: ${Cause.pretty(cause)}`))
      )

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
  validatedApp: App,
  authoredTableIds: AuthoredTableIds
): Effect.Effect<
  DatabaseStartupReport,
  AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> => serverFactory.startDatabase(validatedApp, { authoredTableIds })

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
    fetchSitemapRecords: deps.pageRenderer.fetchSitemapRecords,
    bootstrapToken: deps.bootstrapToken,
  })
}

/** What `startServer` reads from its context; `createAppLayer` provides all of it. */
type StartServerRequirements =
  | ServerFactory
  | PageRenderer
  | Auth
  | AuthRepository
  // The boot sweep of automation runs a previous server left behind.
  | AutomationRunOutcomeRepository
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

export const startServer = (
  app: unknown,
  options: StartOptions = {}
): Effect.Effect<
  ServerInstance,
  | AppValidationError
  | BootEnvironmentError
  | TelemetryConfigurationError
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | TSValidationError
  | Error,
  StartServerRequirements
> =>
  Effect.gen(function* () {
    // G4: a page whose `requires` the app does not meet is dropped HERE, before
    // anything reads `pages` — routing, the sitemap, the palette's page list and
    // the search index all take their view of the app from this object. Gating
    // later would deliver the 404 and none of the rest, leaving the app
    // advertising URLs it refuses to serve.
    const { app: decodedApp, authoredTableIds, bootNotices } = yield* decodeAndValidateApp(app)
    const validatedApp = prunePagesByRequirements(decodedApp)
    yield* validateBootEnvironment(validatedApp)
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
    yield* Effect.forEach(bootNotices, (notice) => logger.warn(notice), { discard: true })

    // Run migrations → config-file version seed → admin bootstrap before
    // `serverFactory.create` (which binds the listener). See
    // `runBootSequenceAndBootstrap` for the full ordering rationale.
    const bootstrapToken = yield* runBootSequenceAndBootstrap(validatedApp, logger)

    const databaseStartup = yield* hoistDatabaseStartup(
      serverFactory,
      validatedApp,
      authoredTableIds
    )

    // Page-search artifacts, before the listener binds. Used to be the CLI's
    // job, which meant every other caller of `startServer` served a 404 for
    // `/sovrium-search/*`. It is a property of the server, so it boots here.
    yield* prepareSearchArtifacts(app, validatedApp, options, logger)

    return yield* createServerInstance(validatedApp, options, {
      serverFactory,
      pageRenderer,
      bootstrapToken,
      databaseStartup,
    })
  }).pipe(Effect.withSpan('server.start-server'))
