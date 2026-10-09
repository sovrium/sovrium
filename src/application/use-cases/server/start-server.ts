/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect } from 'effect'
import { AppValidationError } from '@/application/errors/app-validation-error'
import { DatabaseMigrator } from '@/application/ports/services/database-migrator'
import { PageRenderer } from '@/application/ports/services/page-renderer'
import { ServerFactory } from '@/application/ports/services/server-factory'
import { StorageService } from '@/application/ports/services/storage-service'
import { TypeScriptValidator } from '@/application/ports/services/typescript-validator'
import { validateAiConfiguration } from '@/application/use-cases/ai/validate-ai-configuration'
import { validateEcoAiRouting } from '@/application/use-cases/ai/validate-eco-ai-routing'
import { reapInterruptedRuns } from '@/application/use-cases/automations/reap-interrupted-runs'
import { decodeAppConfigObject } from '@/application/use-cases/config/decode-app-config'
import {
  validateTelemetryConfiguration,
  type TelemetryConfigurationError,
} from '@/application/use-cases/env/validate-telemetry-configuration'
import {
  validateBootEnvironment,
  type BootEnvironmentError,
} from '@/application/use-cases/server/validate-boot-environment'
import { countDatabaseListeners } from '@/domain/models/app/app-database-listeners-service'
import { ENGINE_KEY_UNPREFIXED_TOKEN } from '@/domain/models/app/languages/engine-key-prefix-validation'
import { prunePagesByRequirements } from '@/domain/models/app/pages/page-requires'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { Logger } from '@/infrastructure/logging/logger'
import { publishServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import { getSovriumVersion } from '@/infrastructure/process/version'
import { activateTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import { bootstrapAdminAndToken } from './boot-bootstrap'
import { prepareSearchArtifacts } from './boot-search-artifacts'
import type { StartOptions, StartServerRequirements } from './start-server-options'
import type { DatabaseMigrationError } from '@/application/ports/services/database-migrator'
import type { DatabaseStartupReport } from '@/application/ports/services/server-factory'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type { TSValidationError } from '@/application/ports/services/typescript-validator'
import type { App } from '@/domain/models/app'
import type { AuthoredTableIds } from '@/domain/models/app/tables/authored-table-ids-service'
import type { AuthConfigRequiredForUserFields } from '@/infrastructure/errors/auth-config-required-error'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { SchemaInitializationError } from '@/infrastructure/errors/schema-initialization-error'
import type { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'
import type { Context } from 'effect'

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
): Effect.Effect<string | undefined, DatabaseMigrationError, StartServerRequirements> =>
  Effect.gen(function* () {
    // The instant every run of THIS server postdates, published before anything
    // can start a run, so the sweep below and its on-demand trigger route read
    // the same boundary.
    const bootedAt = publishServerBootInstant()
    yield* (yield* DatabaseMigrator).migrate(parseDatabaseDialectConfig(), {
      listeners: countDatabaseListeners(validatedApp),
    })
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
): Effect.Effect<void, never, StartServerRequirements> =>
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
 * Run the database startup chain for this process, once, before anything
 * renders.
 *
 * It does not run inside `serverFactory.create`, which would make it a
 * property of a SERVER rather than of a start. A page-scoped `search-input`
 * sends `prepareSearchArtifacts` through the static generator; if that asked
 * `create` for a whole server per supported language plus one for the root
 * index, every one of them would re-run migrations, schema init, both column
 * reconcilers, the search-index purge, the seeders and the JWKS rekey survey
 * against the operator's real database (measured at three runs for a
 * single-language app).
 *
 * The render pass creates no server. It asks `serverFactory.buildRenderApp`
 * for an `{ app, dispose }` pair (`infrastructure/server/render-app.ts`), which
 * builds the Hono app and its domain runtime, binds no socket, and runs neither
 * process-wide chain. So the tables a `dataSource`-bound page renders against
 * exist before the pass for exactly one reason: this call ran `startDatabase`
 * first.
 *
 * That makes the ordering a PRECONDITION rather than a tidy-up, and the whole
 * reason this step is hoisted here. Move it after the render pass — or drop it
 * — and a `dataSource`-bound page renders against relations nobody migrated, on
 * precisely the boot where nobody had. A CLI build generation spec is the
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
    // No encryption-key gate here. A server does not refuse to boot without
    // `SOVRIUM_ENCRYPTION_KEY`; it runs on a key it provisions for
    // itself (`infrastructure/crypto/root-secret.ts`), resolved at the composition
    // root before any consumer derives from it.
    // Telemetry (observability-export) gate validation: unset → silently off,
    // set-but-malformed (bad SENTRY_DSN / out-of-range SENTRY_TRACES_SAMPLE_RATE)
    // → boot aborts loudly before the port binds. See the infrastructure observability requirement-*.
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
    yield* validateEcoAiRouting(validatedApp, process.env)
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
