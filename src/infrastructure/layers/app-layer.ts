/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AiLive } from '@/infrastructure/ai/layer'
import { NoAuthLayer } from '@/infrastructure/auth/better-auth/auth-service'
import { TypeScriptValidatorLive } from '@/infrastructure/automations/typescript-validator'
import { OAuthStateStoreLive } from '@/infrastructure/connections/oauth-state-store-live'
import { CSSCompilerLive } from '@/infrastructure/css/css-compiler-live'
import { DatabaseLive } from '@/infrastructure/database/drizzle/layer'
import { BootLedgerRepositoryLive } from '@/infrastructure/database/repositories/admin/boot-ledger-repository-live'
import { AdminAgentConversationsRepositoryLive } from '@/infrastructure/database/repositories/agents/admin-agent-conversations-repository-live'
import { ActivityLogRepositoryLive } from '@/infrastructure/database/repositories/analytics/activity-log-repository-live'
import { AnalyticsRepositoryLive } from '@/infrastructure/database/repositories/analytics/analytics-repository-live'
import { AccountRepositoryLive } from '@/infrastructure/database/repositories/auth/account-repository-live'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'
import { BootstrapTokenRepositoryLive } from '@/infrastructure/database/repositories/auth/bootstrap-token-repository-live'
import { InvitationTokenRepositoryLive } from '@/infrastructure/database/repositories/auth/invitation-token-repository-live'
import { OAuthServerRepositoryLive } from '@/infrastructure/database/repositories/auth/oauth-server-repository-live'
import { OrganizationTeamRepositoryLive } from '@/infrastructure/database/repositories/auth/organization-team-repository-live'
import { AdminAutomationsRepositoryLive } from '@/infrastructure/database/repositories/automations/admin-automations-repository-live'
import { AutomationPauseRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-pause-repository-live'
import { AutomationRunRepositoryLive } from '@/infrastructure/database/repositories/automations/automation-run-repository-live'
import { AdminBucketFilesRepositoryLive } from '@/infrastructure/database/repositories/buckets/admin-bucket-files-repository-live'
import { CommandSearchRepositoryLive } from '@/infrastructure/database/repositories/command-search-repository-live'
import { ConnectionRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-repository-live'
import { ConnectionTokenRepositoryLive } from '@/infrastructure/database/repositories/connections/connection-token-repository-live'
import { DesignSystemShareRepositoryLive } from '@/infrastructure/database/repositories/design-system/design-system-share-repository-live'
import { AdminFormsRepositoryLive } from '@/infrastructure/database/repositories/forms/admin-forms-repository-live'
import { LinkRepositoryLive } from '@/infrastructure/database/repositories/links/link-repository-live'
import { McpAuditRepositoryLive } from '@/infrastructure/database/repositories/mcp/mcp-audit-repository-live'
import { McpInternalsRepositoryLive } from '@/infrastructure/database/repositories/mcp/mcp-internals-repository-live'
import { DataSourceRepositoryLive } from '@/infrastructure/database/repositories/tables/data-source-repository-live'
import { TablesOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables/tables-overview-repository-live'
import { UserEntityListRepositoryLive } from '@/infrastructure/database/repositories/tables/user-entity-list-repository-live'
import { UserTablePreferencesRepositoryLive } from '@/infrastructure/database/repositories/tables/user-table-preferences-repository-live'
import { UserViewRepositoryLive } from '@/infrastructure/database/repositories/tables/user-view-repository-live'
import { UsersDirectoryRepositoryLive } from '@/infrastructure/database/repositories/tables/users-directory-repository-live'
import { UsersOverviewRepositoryLive } from '@/infrastructure/database/repositories/tables/users-overview-repository-live'
import { DevToolsLayerOptional } from '@/infrastructure/devtools'
import { ServerCreationError } from '@/infrastructure/errors/server-creation-error'
import { PageRendererLive } from '@/infrastructure/layers/page-renderer-layer'
import { LoggerLive } from '@/infrastructure/logging/logger'
import { ContentDirReaderLive } from '@/infrastructure/markdown/content-dir-reader-live'
import { CronSchedulerLive } from '@/infrastructure/scheduling/cron-scheduler-live'
import { PageCacheLive } from '@/infrastructure/server/cache/page-cache-live'
import { ServerFactoryLive } from '@/infrastructure/server/server-factory-live'
import { StaticSiteGeneratorLive } from '@/infrastructure/server/static-site-generator-live'
import { StorageLive } from '@/infrastructure/storage/layer'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'
import type { Auth } from '@/infrastructure/auth/better-auth/auth-service'

/**
 * Application layer composition
 *
 * Combines all live service implementations into a single Layer
 * that can be provided to Application use cases.
 *
 * This is the production dependency wiring point - swap out
 * individual layers here for testing or different environments.
 *
 * @example
 * ```typescript
 * // In src/cli/index.ts (CLI entry point)
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(createAppLayer(appConfig.auth))
 * )
 *
 * // In tests (with mocks)
 * const TestLayer = Layer.mergeAll(MockServerFactory, MockPageRenderer)
 * const program = startServer(appConfig).pipe(
 *   Effect.provide(TestLayer)
 * )
 * ```
 */
/**
 * Auth service for the active config, loaded LAZILY.
 *
 * `createAuthLayer` lives in a module that imports `better-auth`, and that
 * subgraph measured 356 ms of a 730 ms cold boot while ~3 apps in 4 declare no
 * `auth:` block at all. Naming it statically here made every boot pay for it.
 *
 * `Layer.unwrap` lets the dynamic import sit INSIDE the layer, so the package
 * is loaded during layer construction rather than at module load. Auth-enabled
 * apps pay nothing extra: `Layer.mergeAll` builds its members concurrently, so
 * this resolves alongside the database and CSS layers instead of after them.
 *
 * The import can REJECT — a mangled binary, a partial container image, a build
 * that emitted no chunk — and an app that declared `auth:` must not come up
 * without authentication. `Effect.promise` made that a nameless defect; the
 * typed `catch` below names it, and `Effect.orDie` keeps it fatal rather than
 * widening `createAppLayer`'s `Layer.Error` with a boot error no consumer of a
 * route handler could do anything about.
 */
const authLayerFor = (authConfig?: AuthConfig): Layer.Layer<Auth> =>
  authConfig
    ? Layer.unwrap(
        Effect.tryPromise({
          try: () => import('@/infrastructure/auth/better-auth/layer'),
          catch: (cause) =>
            new ServerCreationError(
              new Error('Authentication module could not be loaded', { cause })
            ),
        }).pipe(
          Effect.map((module) => module.createAuthLayer(authConfig)),
          Effect.orDie
        )
      )
    : NoAuthLayer

// PageRendererLive requires DataSourceRepository — provide it. Static builds
// may not have DATABASE_URL, so the live implementation gracefully returns
// empty results when no database is available; `createStaticBuildLayer` below
// shares this one declaration.
//
// Hoisted out of `createAppLayer`: neither this nor `DatabaseBackedRepositories`
// below reads `authConfig`, so rebuilding them per call bought nothing and cost
// a stable layer reference for Effect to memoise on.
const PageRendererWithDeps = PageRendererLive.pipe(Layer.provide(DataSourceRepositoryLive))

// Ports whose live implementation READS the `Database` service rather than
// opening its own handle (`Layer.effect` + `yield* Database`, as against the
// `Layer.succeed` majority that call `getDb()` internally).
//
// `Layer.mergeAll` does not wire its members into one another, so a merged
// `Database`-reading layer would export its service AND re-publish `Database`
// as an unmet requirement of the whole app layer — which is what the retired
// per-folder runners were quietly doing with their own `Layer.provide`.
// `DatabaseLive` is merged below as well, so `Database` itself stays available
// to handlers; Effect memoises it, so naming it twice builds it once.
const DatabaseBackedRepositories = Layer.mergeAll(
  UserViewRepositoryLive,
  UserTablePreferencesRepositoryLive,
  // `LinkRepository` — the links console and the `link/*` automation steps
  // call the same use-cases, so the port belongs to the app rather than to
  // either caller. `AutomationRuntimeLayer` names this same layer for its own
  // handlers; naming it twice builds it once, and having it HERE is what lets
  // the console route read it off the request instead of relying on the
  // automation runtime to have happened to bring it along.
  LinkRepositoryLive
).pipe(Layer.provide(DatabaseLive))

export const createAppLayer = (authConfig?: AuthConfig) =>
  Layer.mergeAll(
    authLayerFor(authConfig),
    DatabaseLive,
    ServerFactoryLive,
    PageRendererWithDeps,
    CSSCompilerLive,
    StaticSiteGeneratorLive,
    DevToolsLayerOptional,
    // NOTE: OTel trace export is NOT wired here. It moved to the pre-built unified
    // observability runtime (`observability-runtime.ts`), armed by
    // OTEL_EXPORTER_OTLP_TRACES_ENDPOINT and disposed on shutdown — the app-layer
    // scope closes right after boot, so a scoped tracer wired here would be
    // finalized before it ever exported a span. See
    // [internal ref].
    LoggerLive,
    AuthRepositoryLive,
    // `BootstrapTokenRepository` — the boot-time first-admin token flow in
    // `startServer`, which bound this for itself until W5a. A `Layer.succeed`,
    // so naming it here costs the boot nothing.
    BootstrapTokenRepositoryLive,
    // `AnalyticsRepository` — the first port moved here by the server-runtime
    // work (W3). It used to be re-provided per call by
    // `presentation/api/routes/analytics/effect-runner.ts`, which that folder's
    // handlers, the sibling `routes/analytics.ts` readers, and the short-link
    // redirect all reached for. Carried by the app layer, it is resolved once at
    // boot and handed to every request by the runtime `createServer` owns.
    //
    // Each W3b..n folder adds its ports here the same way, and retires its own
    // runner once that runner's LAST caller has moved.
    AnalyticsRepositoryLive,
    // W3b onward — one port set per route folder, each added when that folder's
    // handlers moved to `provideDomain` and its runner was retired.
    AccountRepositoryLive,
    CommandSearchRepositoryLive,
    AdminAgentConversationsRepositoryLive,
    AdminBucketFilesRepositoryLive,
    UsersDirectoryRepositoryLive,
    UsersOverviewRepositoryLive,
    // `TablesOverviewRepository` — the live row-count read behind the dashboard
    // `records` tile (W5a). Every other port the admin overview roll-up needs
    // was already here; this was the last one each block still bound for itself.
    TablesOverviewRepositoryLive,
    UserEntityListRepositoryLive,
    AdminFormsRepositoryLive,
    ConnectionRepositoryLive,
    ConnectionTokenRepositoryLive,
    OAuthStateStoreLive,
    AdminAutomationsRepositoryLive,
    AutomationPauseRepositoryLive,
    AutomationRunRepositoryLive,
    // ─── W5b: the ports that unblocked `route-setup/` ──────────────────────
    //
    // Six layers, one wave, one reason: each retired a live `db` handle from a
    // file that answers an HTTP request. They are grouped rather than filed
    // alphabetically because what they have in common is the wave, not the
    // feature — and because the group is what shrinks when a later wave finds a
    // better home for one of them.
    //
    // `OAuthServerRepository` — the RFC 7662 introspection path for PUBLIC
    // clients (`auth-routes.ts`) and the branded consent screen
    // (`oauth-consent-routes.ts`). Read-only; every write to those tables
    // belongs to `@better-auth/oauth-provider`.
    OAuthServerRepositoryLive,
    // `OrganizationTeamRepository` — the group-management reads layered on top
    // of Better Auth's `organization` plugin, scoped to this instance's single
    // organization BY CONTRACT so no caller can be written with the wrong
    // tenant id.
    OrganizationTeamRepositoryLive,
    // `InvitationTokenRepository` — the one invitation query an HTTP route
    // makes (accept). The other eleven stay with the better-auth-adjacent
    // module that legitimately holds a handle.
    InvitationTokenRepositoryLive,
    // The two MCP stores. `McpAuditRepository` is the tool-call trail;
    // `McpInternalsRepository` is the generic `{schema}_{table}_{list,read}`
    // reader over the admin-internal registry. Both were raw SQL inside the
    // route tree, and one had already shipped a dialect bug there.
    McpAuditRepositoryLive,
    McpInternalsRepositoryLive,
    // `DesignSystemShareRepository` — the public share reader at
    // `/s/design-system/:token`. It was the last route in the tree building its
    // own `Layer.provide(…, DatabaseLive)` per request.
    DesignSystemShareRepositoryLive,
    // `BootLedgerRepository` — bound here rather than per request because it
    // has two callers on two paths: the admin reads, through `provideDomain`,
    // and the boot capture, which is no request at all (`startup-database.ts`).
    BootLedgerRepositoryLive,
    // `ContentDirReader` — the filesystem half of `infrastructure/markdown/`.
    // The markdown RENDERER needs no port (it is pure, and
    // `presentation-rendering` reaches it directly); the `stat` does.
    ContentDirReaderLive,
    // `PageCache` — the process-local store of rendered page HTML. Same split
    // as the line above: the cache KEY is a pure domain function every layer
    // calls directly, while reading and writing the store is behaviour behind a
    // port. Its state is a module-level singleton, so binding it here hands the
    // runtime the shared store rather than a private copy.
    PageCacheLive,
    DatabaseBackedRepositories,
    ActivityLogRepositoryLive,
    // `AiService` — admissible here only since the Ollama reachability probe
    // moved out of `AiServiceLive`'s layer body (W9a). While the probe ran at
    // construction, this layer reached the network to build itself and a
    // configured-but-unreachable `OLLAMA_BASE_URL` would have cost the boot the
    // full 2 s timeout before the listener bound — which is precisely why the
    // three AI-adjacent route runners kept rebuilding it per request. The body
    // is now pure; the probe happens on the first `chat`/`embed`.
    AiLive,
    StorageLive,
    TypeScriptValidatorLive,
    // Currently unused at the AppLayer scope: the only consumer
    // (`registerCronAutomations`) self-provides `CronSchedulerLive` so it can
    // be invoked outside the `Effect.provide(createAppLayer(...))` boundary
    // (called from `createServer` directly, not from a use-case). Wired here
    // anyway so future callers that yield `CronScheduler` from inside an
    // app-layer-provided program see the live adapter without extra wiring.
    CronSchedulerLive
  )

/**
 * Static build layer composition
 *
 * A minimal layer for static site generation that excludes database,
 * auth, and repository services. Static builds only need rendering
 * and CSS compilation — no database connection required.
 *
 * This prevents subprocess hangs when `build()` is called without
 * DATABASE_URL (e.g., in E2E tests or CI static generation).
 */
export const createStaticBuildLayer = Layer.mergeAll(
  ServerFactoryLive,
  PageRendererWithDeps,
  CSSCompilerLive,
  StaticSiteGeneratorLive,
  DevToolsLayerOptional,
  LoggerLive
)
