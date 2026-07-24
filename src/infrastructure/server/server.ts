/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { readFileSync, rmSync } from 'node:fs'
import { Effect, Config } from 'effect'
import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { requestId } from 'hono/request-id'
import { AiService } from '@/application/ports/services/ai-service'
import { purgeOldAnalyticsData } from '@/application/use-cases/analytics/purge-old-data'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { appRequiresEmail, isAdminEquivalent } from '@/domain/models/app'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { filterAgentKnowledgeTables } from '@/domain/services/rag/rag-knowledge-access'
import { AiLive } from '@/infrastructure/ai/layer'
import { runSyncAgentUsers } from '@/infrastructure/auth/agent-user-sync'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { runOrgTeamSeeding } from '@/infrastructure/auth/better-auth/org-team-seeder'
import { runSeedAllConnectionDefinitions } from '@/infrastructure/connections/test-token-seeder'
import { compileCSS } from '@/infrastructure/css/compiler'
import { AiComputeListener } from '@/infrastructure/database/ai-compute-listener'
import {
  runRagKnowledgeStartup,
  stopAiKnowledgeListener,
} from '@/infrastructure/database/ai-knowledge-listener'
import { runMigrations } from '@/infrastructure/database/drizzle/migrate'
import { isAiComputeFieldType } from '@/infrastructure/database/generators/ai-field-triggers'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import {
  initializeSchema,
  type AuthConfigRequiredForUserFields,
  type SchemaInitializationError,
} from '@/infrastructure/database/schema/schema-initializer'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { isEmailConfigured } from '@/infrastructure/email/email-config'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { isIpHashSaltConfigured } from '@/infrastructure/forms/ip-hash'
import {
  logDebug,
  logError,
  logWarning,
  renderStartupSummary,
  type StartupPhase,
} from '@/infrastructure/logging/logger'
import { registerAccountPurgeScheduler } from '@/infrastructure/scheduling/register-account-purge'
import {
  disposeCronScheduler,
  registerCronAutomations,
} from '@/infrastructure/scheduling/register-cron-automations'
import { applyBootstrapTokenToSummary } from '@/infrastructure/server/bootstrap-banner'
import {
  computeConfigHash,
  getLockFilePath,
  writeLockFile as writeLockFileToDisk,
} from '@/infrastructure/server/lock-file'
import { legacyHostRedirect } from '@/infrastructure/server/middleware/legacy-host-redirect'
import { requestLogger } from '@/infrastructure/server/middleware/request-logger'
import { securityHeaders } from '@/infrastructure/server/middleware/security-headers'
import { createApiRoutes } from '@/infrastructure/server/route-setup/api-routes'
import {
  setupAuthMiddleware,
  setupAuthRoutes,
} from '@/infrastructure/server/route-setup/auth-routes'
import { setupBootstrapRoutes } from '@/infrastructure/server/route-setup/bootstrap-routes'
import { setupDevReloadRoute } from '@/infrastructure/server/route-setup/dev-reload-routes'
import { setupMcpRoutes } from '@/infrastructure/server/route-setup/mcp/routes'
import { setupOpenApiRoutes } from '@/infrastructure/server/route-setup/openapi-routes'
import {
  setupPageRoutes,
  type HonoAppConfig,
} from '@/infrastructure/server/route-setup/page-routes'
import { setupSeoRoutes } from '@/infrastructure/server/route-setup/seo-routes'
import { setupStaticAssets } from '@/infrastructure/server/route-setup/static-assets'
import {
  collectStoragePhases,
  collectAiListenerPhases,
  collectAdminPhases,
  collectPublicDirPhases,
  collectTelemetryPhases,
  buildStartupPhases,
  databaseStartupLabel,
} from '@/infrastructure/server/startup-degradation-phases'
import { validateStoragePublicAccessEnv } from '@/infrastructure/server/validate-storage-public-access-env'
import { validateTransformPresetEnv } from '@/infrastructure/server/validate-transform-preset-env'
import { reportException } from '@/infrastructure/telemetry/error-reporter'
import { createPerformanceMiddleware } from '@/infrastructure/telemetry/performance-middleware'
import { getTelemetryConfig } from '@/infrastructure/telemetry/telemetry-config'
import { shutdownTelemetry } from '@/infrastructure/telemetry/telemetry-sink'
import { getSovriumVersion } from '@/infrastructure/utils/version'
import type { ServerInstance } from '@/application/models/server'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import type { SessionInfo } from '@/domain/types/session-info'
import type {
  DatabaseConnectionError,
  MigrationError,
} from '@/infrastructure/database/drizzle/migrate'
import type { CSSCompilationError } from '@/infrastructure/errors/css-compilation-error'
import type { TransformPresetError } from '@/infrastructure/errors/transform-preset-error'

export interface ServerConfig {
  readonly app: App
  readonly port?: number
  readonly hostname?: string
  readonly publicDir?: string
  readonly silent?: boolean
  readonly configHash?: string
  readonly configPath?: string
  readonly renderPage: (
    app: App,
    path: string,
    requestContext?: {
      readonly detectedLanguage?: string
      readonly session?: SessionInfo
      readonly cookies?: Readonly<Record<string, string>>
      readonly previewMode?: boolean
      readonly requestQuery?: Readonly<Record<string, string>>
    }
  ) => PageRenderResult | Promise<PageRenderResult>
  readonly renderNotFoundPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderErrorPage: (app?: App, detectedLanguage?: string) => string | Promise<string>
  readonly renderRssFeed?: (app: App, baseUrl: string) => Promise<string | undefined>
  readonly bootstrapToken?: string
}

function buildGetSession(
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app: Readonly<App>
): (headers: Headers) => Promise<SessionInfo | undefined> {
  return async (headers) => {
    try {
      const session = await authInstance.api.getSession({ headers })
      if (!session) return undefined
      const user = session.user as { id: string; email?: string; name?: string; role?: string }
      const role = user.role ?? 'member'
      const isUnrestricted = isAdminEquivalent(role, app)
      const groups = await getUserGroups(user.id)
      const effectiveRoles = buildEffectiveRoles(role, groups)
      return {
        userId: user.id,
        role,
        email: user.email,
        name: user.name,
        isUnrestricted,
        groups,
        effectiveRoles,
      }
    } catch {
      return undefined
    }
  }
}

function mountPerformanceMiddleware(honoApp: Readonly<Hono>): void {
  const telemetryConfig = getTelemetryConfig()
  if (telemetryConfig.performance !== undefined) {
    honoApp.use('*', createPerformanceMiddleware(telemetryConfig.performance.sampleRate))
  }
}

export async function createHonoApp(
  config: HonoAppConfig & { readonly configHash?: string }
): Promise<Readonly<Hono>> {
  const { app, renderNotFoundPage, renderErrorPage, configHash } = config

  const authInstance = app.auth ? createAuthInstance(app.auth, app.connections, app) : undefined
  const getSession = authInstance ? buildGetSession(authInstance, app) : undefined

  const honoApp = new Hono()

  honoApp.use('*', requestId()).use('*', securityHeaders)

  mountPerformanceMiddleware(honoApp)

  honoApp.use('*', legacyHostRedirect)

  let currentConfigHash = configHash ?? ''
  if (currentConfigHash) {
    honoApp.use('*', async (c, next) => {
      await next()
      c.header('X-Sovrium-Config', currentConfigHash)
    })
  }

  ;(honoApp as any).__setConfigHash = (hash: string) => {
    currentConfigHash = hash
  }

  const analyticsEnabled = app.analytics !== undefined && app.analytics !== false
  if (analyticsEnabled) {
    const retentionDays =
      typeof app.analytics === 'object' ? app.analytics.retentionDays : undefined

    honoApp.use('*', async (_c, next) => {
      await Effect.runPromise(
        purgeOldAnalyticsData(app.name, retentionDays).pipe(
          Effect.provide(AnalyticsRepositoryLive),
          Effect.catchAll(() => Effect.void)
        )
      )
      return next()
    })
  }

  const honoWithLogger = honoApp.use('*', requestLogger)
  const honoWithBootstrap = setupBootstrapRoutes(honoWithLogger, app)

  const honoWithRoutes = setupPageRoutes(
    setupDevReloadRoute(
      await setupStaticAssets(
        setupSeoRoutes(
          setupMcpRoutes(
            setupAuthRoutes(
              setupAuthMiddleware(
                setupOpenApiRoutes(createApiRoutes(app, honoWithBootstrap as Hono), app),
                app
              ),
              app,
              authInstance
            ),
            app
          ),
          app
        ),
        app,
        config.publicDir
      )
    ),
    { ...config, getSession }
  )

  return honoWithRoutes
    .notFound(async (c) => c.html(await renderNotFoundPage(app), 404))
    .onError(async (error, c) => {
      void reportException(error, {
        method: c.req.method,
        url: c.req.url,
        headers: Object.fromEntries(c.req.raw.headers.entries()),
      })
      logError(`[SERVER] ${c.req.method} ${c.req.path} → 500`, error)
      return c.html(await renderErrorPage(app), 500)
    })
}

const parsePort = (value: string | undefined): number | undefined => {
  if (!value) return undefined
  const parsed = parseInt(value, 10)
  return !isNaN(parsed) && parsed >= 0 && parsed <= 65_535 ? parsed : undefined
}

const createStopEffect = (
  server: ReturnType<typeof Bun.serve>,
  aiComputeListener?: Readonly<AiComputeListener>
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    logDebug('Stopping server...')
    disposeCronScheduler()
    if (aiComputeListener) yield* Effect.promise(() => aiComputeListener.stop().catch(() => {}))
    yield* Effect.promise(() => stopAiKnowledgeListener().catch(() => {}))
    yield* Effect.promise(() => shutdownTelemetry().catch(() => {}))
    yield* Effect.promise(() => server.stop())
    logDebug('Server stopped')
  })

const getDatabaseUrl = (): Effect.Effect<string, never> =>
  Config.string('DATABASE_URL').pipe(
    Config.withDefault(''),
    Effect.catchAll(() => Effect.succeed(''))
  )

const buildBunServeOptions = (honoApp: Readonly<Hono>, port: number, hostname: string) => ({
  port,
  hostname,
  fetch: (request: Request, server: unknown): Response | Promise<Response> =>
    honoApp.fetch(request, { server }),
  websocket,
})

const startBunServer = (
  honoApp: Readonly<Hono>,
  port: number,
  hostname: string
): Effect.Effect<ReturnType<typeof Bun.serve>, ServerCreationError, never> =>
  Effect.try({
    try: () => Bun.serve(buildBunServeOptions(honoApp, port, hostname)),
    catch: (error) => new ServerCreationError(error),
  }).pipe(
    Effect.catchIf(
      (e) => {
        const { cause } = e as ServerCreationError
        return (
          typeof cause === 'object' &&
          cause !== null &&
          'code' in cause &&
          (cause as { code: string }).code === 'EADDRINUSE'
        )
      },
      () =>
        Effect.try({
          try: () => {
            logWarning(`[SERVER] Port ${port} in use; using an OS-assigned port (see URL below).`)
            return Bun.serve(buildBunServeOptions(honoApp, 0, hostname))
          },
          catch: (error) => new ServerCreationError(error),
        })
    )
  )

const getPackageVersion = (): Effect.Effect<string, never> =>
  Effect.promise(() => getSovriumVersion())

const resolveAiComputeListener = (
  app: App,
  databaseUrl: string
): Effect.Effect<Readonly<AiComputeListener> | undefined, never> =>
  Effect.gen(function* () {
    if (!databaseUrl) return undefined
    if (isSqliteRuntime()) return undefined
    const tables = app.tables ?? []
    const hasAiComputeField = tables.some((table) =>
      table.fields.some((field) => isAiComputeFieldType(field.type))
    )
    if (!hasAiComputeField) return undefined

    const aiService = yield* AiService
    if (!aiService.isConfigured()) return undefined

    return new AiComputeListener(databaseUrl, app.name)
  }).pipe(Effect.provide(AiLive))

const startAiComputeListenerIfNeeded = (
  app: App,
  databaseUrl: string
): Effect.Effect<Readonly<AiComputeListener> | undefined, never> =>
  Effect.gen(function* () {
    const listener = yield* resolveAiComputeListener(app, databaseUrl)
    if (!listener) return undefined

    return yield* Effect.promise(() =>
      listener
        .start()
        .then(() => listener)
        .catch(() => undefined)
    )
  })

const filterRagKnowledgeByRole = (app: App) =>
  (app.agents ?? []).map((agent) => filterAgentKnowledgeTables(agent, app.tables ?? []))

const runDatabaseStartup = (
  app: App,
  dialectConfig: DatabaseDialectConfig
): Effect.Effect<
  readonly StartupPhase[],
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | DatabaseConnectionError
  | MigrationError
> => {
  const ragDatabaseUrl = dialectConfig.dialect === 'postgres' ? dialectConfig.databaseUrl : ''
  return runMigrations(dialectConfig).pipe(
    Effect.flatMap(() => initializeSchema(app)),
    Effect.flatMap(() =>
      Effect.promise(() => runSeedAllConnectionDefinitions({ connections: app.connections }))
    ),
    Effect.flatMap(() =>
      Effect.promise(() => runSyncAgentUsers({ agents: app.agents, hasAuth: !!app.auth }))
    ),
    Effect.flatMap(() => Effect.promise(() => runOrgTeamSeeding(app))),
    Effect.flatMap(() =>
      Effect.promise(() => runRagKnowledgeStartup(filterRagKnowledgeByRole(app), ragDatabaseUrl))
    ),
    Effect.map((): readonly StartupPhase[] => [
      { label: databaseStartupLabel(dialectConfig), type: 'success' as const },
    ])
  )
}

const collectInfraPhases = (
  app: App
): Effect.Effect<
  {
    readonly phases: readonly StartupPhase[]
    readonly cssSizeKB: number
    readonly cssLabel: string
    readonly aiComputeListener: Readonly<AiComputeListener> | undefined
  },
  CSSCompilationError | AuthConfigRequiredForUserFields | SchemaInitializationError | Error
> =>
  Effect.gen(function* () {
    const databaseUrl = yield* getDatabaseUrl()
    const dialectConfig = parseDatabaseDialectConfig()
    const databasePhases: readonly StartupPhase[] = yield* runDatabaseStartup(app, dialectConfig)

    const adminPhases = yield* Effect.promise(() => collectAdminPhases(app))

    const smtpPhases: readonly StartupPhase[] =
      appRequiresEmail(app) && !isEmailConfigured()
        ? [
            {
              label: 'Email sending disabled — SMTP not configured (set SMTP_HOST to enable)',
              type: 'warning' as const,
            },
          ]
        : []

    const formSaltPhases: readonly StartupPhase[] =
      (app.forms?.length ?? 0) > 0 && !isIpHashSaltConfigured()
        ? [
            {
              label:
                'FORM_IP_HASH_SALT not set — submitter IP hashes will reset on every restart (set a long random value)',
              type: 'warning' as const,
            },
          ]
        : []

    const storagePhases = collectStoragePhases()

    const telemetryPhases = collectTelemetryPhases()

    const aiListenerPhases = collectAiListenerPhases(app)

    const cssResult = yield* compileCSS(app)
    const cssSizeKB = Math.round(cssResult.css.length / 1024)
    const cssLabel = cssResult.precompiled
      ? `CSS loaded from file (${cssSizeKB} KB)`
      : `CSS compiled (${cssSizeKB} KB)`

    const aiComputeListener = yield* startAiComputeListenerIfNeeded(app, databaseUrl)

    return {
      phases: [
        ...databasePhases,
        ...adminPhases,
        ...smtpPhases,
        ...formSaltPhases,
        ...storagePhases,
        ...telemetryPhases,
        ...aiListenerPhases,
      ],
      cssSizeKB,
      cssLabel,
      aiComputeListener,
    }
  })

const writeLockFile = (
  port: number | undefined,
  configHash: string,
  configPath: string
): Effect.Effect<void, never> =>
  Effect.tryPromise(() =>
    writeLockFileToDisk({ pid: process.pid, port: port ?? 0, configHash, configPath })
  ).pipe(Effect.catchAll(() => Effect.void))

const cleanupLockFileSync = (): void => {
  try {
    const lockPath = getLockFilePath()
    const raw = readFileSync(lockPath, 'utf-8')
    const data = JSON.parse(raw) as { pid: number }
    if (data.pid === process.pid) {
      rmSync(lockPath, { force: true })
    }
  } catch {
  }
}

const registerLockFileCleanup = (honoApp: Readonly<Hono>, configPath: string): void => {
  process.on('SIGTERM', cleanupLockFileSync)
  process.on('SIGINT', cleanupLockFileSync)

  process.on('SIGUSR1', () => {
    if (!configPath) return
    try {
      const content = readFileSync(configPath, 'utf-8')
      const newHash = computeConfigHash(content)
      const setter = (honoApp as any).__setConfigHash as ((hash: string) => void) | undefined
      if (setter) setter(newHash)
    } catch {
    }
  })
}

const renderStartup = (
  phases: readonly StartupPhase[],
  url: string,
  durationMs: number,
  bootstrapToken?: string
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const version = yield* getPackageVersion()
    const augmented = applyBootstrapTokenToSummary(phases, bootstrapToken)
    yield* renderStartupSummary({
      version,
      phases: augmented.phases,
      url,
      durationMs,
      ...(augmented.bootstrapToken ? { bootstrapToken: augmented.bootstrapToken } : {}),
    })
  })

const collectAllPhases = (config: ServerConfig) =>
  Effect.gen(function* () {
    const r = yield* collectInfraPhases(config.app)
    const pd = yield* Effect.promise(() => collectPublicDirPhases(config.publicDir))
    return { ...r, infraPhases: [...r.phases, ...pd] }
  })

const buildHonoAppFromConfig = (config: ServerConfig): Promise<Readonly<Hono>> =>
  createHonoApp({
    app: config.app,
    publicDir: config.publicDir,
    configHash: config.configHash ?? '',
    renderPage: config.renderPage,
    renderNotFoundPage: config.renderNotFoundPage,
    renderErrorPage: config.renderErrorPage,
    ...(config.renderRssFeed !== undefined ? { renderRssFeed: config.renderRssFeed } : {}),
  })

export const createServer = (
  config: ServerConfig
): Effect.Effect<
  ServerInstance,
  | ServerCreationError
  | CSSCompilationError
  | AuthConfigRequiredForUserFields
  | SchemaInitializationError
  | TransformPresetError
  | Error
> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    yield* validateTransformPresetEnv()
    yield* validateStoragePublicAccessEnv()
    const port = config.port ?? parsePort(Bun.env.PORT) ?? 3000
    const hostname = config.hostname ?? (Bun.env.HOSTNAME || 'localhost')
    const { configHash = '', configPath = '' } = config

    const { infraPhases, cssLabel, aiComputeListener } = yield* collectAllPhases(config)

    const honoApp = yield* Effect.promise(() => buildHonoAppFromConfig(config))
    const server = yield* startBunServer(honoApp, port, hostname)
    const url = `http://${hostname}:${server.port}`

    yield* registerCronAutomations(config.app, process.env)

    yield* registerAccountPurgeScheduler(config.app)

    const durationMs = Date.now() - startTime

    const phases = buildStartupPhases({ infraPhases, cssLabel, durationMs, bindHost: hostname })

    if (!config.silent) {
      yield* writeLockFile(server.port, configHash, configPath)
      registerLockFileCleanup(honoApp, configPath)
      yield* renderStartup(phases, url, durationMs, config.bootstrapToken)
    }

    return {
      server,
      url,
      stop: createStopEffect(server, aiComputeListener),
      app: honoApp,
    }
  })
