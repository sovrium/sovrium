/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE Hono composition root.
 *
 * One file assembles the application, in its phases: the guard chain
 * (`app-guard-chain.ts`), the request middleware (`app-request-middleware.ts`),
 * the API route stack, the site stack (assets, links, redirects, pages), then
 * the last-resort error boundary (`app-error-boundary.ts`). It is the only
 * place that knows both halves — which is what lets every route module stay
 * ignorant of the others — and the only infrastructure file that may import
 * presentation, so every presentation piece a phase needs is handed to it
 * from here.
 */

import { Context } from 'effect'
import { Hono } from 'hono'
import { AssetStore } from '@/application/ports/services/asset-store'
import { mountedInvitationPages } from '@/domain/models/app/pages/invitation-link-service'
import { resolvesToDeclaredPage } from '@/domain/models/app/pages/page-path-resolvability'
import { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import { createInvitationServices } from '@/infrastructure/auth/better-auth/invitation-services'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { isLiveReloadEligible } from '@/infrastructure/process/env'
import { adminMountsFor } from '@/infrastructure/server/admin-mounts'
import { attachErrorBoundary } from '@/infrastructure/server/app-error-boundary'
import { mountGuardChain } from '@/infrastructure/server/app-guard-chain'
import { mountRequestMiddleware } from '@/infrastructure/server/app-request-middleware'
import { makeAuthHookPolicies } from '@/infrastructure/server/auth-hook-policies'
import { resolveAuthContext } from '@/infrastructure/server/hono-auth-context'
import { setupStaticAssets } from '@/infrastructure/server/route-setup/static-assets'
import { readStatusDocument } from '@/infrastructure/server/status-file'
import { makeAdminReadHost } from '@/presentation/api/admin/admin-read-host'
import { setupDesignSystemShareRoutes } from '@/presentation/api/admin/design-system-share-reader-routes'
import { setupAdminMountRoutes } from '@/presentation/api/admin/mount-routes'
import { fireAgentSchedule } from '@/presentation/api/agents/agent-schedule-runner'
import { setupAuthMiddleware } from '@/presentation/api/auth/auth-middleware'
import { setupAuthRoutes } from '@/presentation/api/auth/better-auth-routes'
import { setupOauthConsentRoutes } from '@/presentation/api/auth/oauth-consent-routes'
import { createApiRoutes } from '@/presentation/api/compose-api-routes'
import { setupLinkRoutes } from '@/presentation/api/links/routes'
import { setupMcpRoutes } from '@/presentation/api/mcp/routes'
import { crossSiteRequestGuard } from '@/presentation/api/middleware/cross-site-request-guard'
import { setupOpenApiRoutes } from '@/presentation/api/openapi/routes'
import { setupIconGeometryRoutes } from '@/presentation/api/pages/icon-geometry-routes'
import { setupInstallRoutes } from '@/presentation/api/pages/install-routes'
import { setupPageRoutes } from '@/presentation/api/pages/page-routes'
import { setupRedirectRoutes } from '@/presentation/api/pages/redirect-routes'
import { setupSeoRoutes } from '@/presentation/api/pages/seo-routes'
import { notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import { setupBootstrapRoutes } from '@/presentation/api/server/bootstrap-routes'
import { setupDevReloadRoute } from '@/presentation/api/server/dev-reload-routes'
import type { HonoAppConfig } from '@/application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/server/domain-runtime'

/**
 * Everything `createHonoApp` takes beyond {@link HonoAppConfig}.
 *
 * `domainContext` is the resolved domain services of the runtime `createServer`
 * owns — a PARAMETER, exactly as the Better Auth instance is, and for the same
 * reason: a server may be booted many times in one process (`serverMode:
 * 'inprocess'`), so nothing about it may live at module scope. It is required
 * rather than optional because every caller has one, and an optional field
 * would let a handler reach a program with no services and discover it as a
 * defect at request time.
 */
interface HonoAppExtras {
  readonly configHash?: string
  readonly domainContext: DomainContext
  /**
   * This app renders a static build (`render-app.ts`) rather than serving
   * requests. A build is never a `--watch` session, so it mounts no dev
   * live-reload surface whatever `NODE_ENV` says — no route, and no tag in
   * the pages it renders.
   */
  readonly staticRender?: boolean
}

/**
 * An `/api/*` path no API route claimed answers the canonical JSON 404 — unless
 * the app itself declares a page there.
 *
 * The prefix names the engine's HTTP API, not a forbidden spelling: a
 * configuration may declare a page at `/api/v1/users/profile`, and that page is
 * served (and emitted by a static build) like any other. So a declared page
 * falls through to the page routes, which also own its access check.
 */
const answerUnmatchedApiPaths =
  (app: App) =>
  (honoApp: Readonly<Hono>): Readonly<Hono> =>
    honoApp.all('/api/*', (c, next) =>
      resolvesToDeclaredPage(app, c.req.path) ? next() : c.json(notFoundBody(), 404)
    )

/**
 * The agent-schedule fire, re-exported from the ONE infrastructure file allowed
 * to name presentation.
 *
 * A pass-through and nothing else, and it earns its place by WHERE it is rather
 * than by what it does. `register-agent-schedules.ts` arms the cron jobs and
 * needs this function; it is not a composition root, so it may not import
 * presentation, and `server.ts` — which calls both — reaches no presentation
 * module at all today and should not start.
 *
 * So the import lands here, beside the other place this file already knows both
 * sides of the boundary, and the registrar takes the function as a parameter.
 * The proper fix is a use-case, and it is not available yet: the runner pulls
 * six siblings out of `presentation/api/agents/`, so the whole agent-run
 * cluster has to move together. See `register-agent-schedules.ts` for that
 * measurement.
 */
export { fireAgentSchedule }

/** The auth context `resolveAuthContext` resolved for this app. */
type AuthContext = Awaited<ReturnType<typeof resolveAuthContext>>

type AppConfig = HonoAppConfig & HonoAppExtras

/**
 * The API route stack, innermost first: every `<slug>/routes.ts` through
 * `createApiRoutes`, then the OpenAPI documents, the auth middleware, the Better
 * Auth routes, MCP, icon geometry and the install routes.
 *
 * Chained directly — this pattern is required for Hono RPC type inference.
 */
const mountApiStack = (
  honoWithBootstrap: Readonly<Hono>,
  config: AppConfig,
  { runtime, authInstance, getSession }: AuthContext
): Readonly<Hono> => {
  const { app, configHash } = config
  const database = Context.get(config.domainContext, Database)
  // Built HERE, at the composition root, and threaded into the auth route chain
  // — the same vector `authInstance` travels on.
  //
  // If `auth-routes.ts` called `createEmailHandlers` itself, `sendEmail` and a
  // live nodemailer transport would sit in the import graph of a file that is
  // otherwise a request handler. Constructing it at the root is what lets that
  // file name the factory as a TYPE only and hold no transport.
  const emailHandlers = createEmailHandlers(app?.auth, app?.name, undefined, app.languages)
  // There are no config-mutation REST routes (config-code-only, [internal ref]):
  // config changes ONLY by editing the app config file.

  // The install routes sit at the top of this stack — after every API route,
  // ahead of the static assets and the page catch-all — and NOT ahead of
  // `createApiRoutes`: mounted there, the walk that serves three releases
  // one after another on one port failed. The cause was not isolated;
  // keep this slot until it is.
  return setupInstallRoutes(
    setupIconGeometryRoutes(
      setupMcpRoutes(
        setupAuthRoutes(
          setupAuthMiddleware(
            setupOpenApiRoutes(
              createApiRoutes(app, honoWithBootstrap as Hono, authInstance, getSession),
              app,
              authInstance
            ),
            app
          ),
          app,
          {
            authInstance,
            runtime,
            emailHandlers,
            // The admin-invitation store and engine over the same
            // instance — built here so the invitation use-cases
            // hold no query module and no engine type.
            invitations: createInvitationServices(authInstance, {
              database,
              linkPages: () => mountedInvitationPages(adminMountsFor(app)),
              // An acceptance starts the app's auth automations.
              hookContext: {
                appMeta: app,
                domainContext: config.domainContext,
                policies: makeAuthHookPolicies(database, config.domainContext),
                database,
              },
            }),
          }
        ),
        app,
        {
          domainContext: config.domainContext,
          authInstance,
          // The two file-backed facts the A8 config tools publish.
          // Supplied HERE because this is the one composition root
          // that may name both `infrastructure-server` and the
          // presentation tree; a route may not reach the status
          // file itself.
          configHash: configHash ?? '',
          readStatusDocument,
          // The admin read tools answer against the same host the
          // admin routes build, which belongs to the admin slug.
          makeAdminReadHost,
        }
      )
    ),
    app
  )
}

/**
 * The site stack over the API stack: live SEO, static assets, dev reload, short
 * links, the design-system share reader, OAuth consent, redirects, the unmatched
 * `/api/*` answer, then the page routes.
 *
 * Live SEO routes (/sitemap.xml, /robots.txt) are registered BEFORE the
 * public-directory catch-all (inside setupStaticAssets) so the generated
 * routes win over same-named static files, and they sit ahead of the page
 * catch-all so they aren't treated as page paths.
 * `setupStaticAssets` is async (it realpath()s `publicDir` once at mount
 * time for the symlink-escape guard); the await sits inline so the rest of
 * the pipeline stays a single expression.
 *
 * `app.redirects` sits AFTER the static-assets stack and BEFORE the page
 * routes — the one position where a real public-directory file still wins (a
 * rule can never hijack `/install`) while a retired path still answers its
 * redirect instead of the page catch-all's 404.
 *
 * `app.links` takes the same slot, just inside the redirect layer, for the same
 * reason plus one that is MANDATORY rather than stylistic: `setupLanguageRoutes`
 * (inside `setupPageRoutes`) registers `/:lang/*`, which matches `/l/abc`, and
 * its handler renders a 404 terminally instead of calling `next()`. Mounted
 * after the page routes, every short link would 404.
 *
 * Every API route is registered by now, and the page routes below match any
 * path (`/:lang/*`, `*`) and render the HTML not-found page. An `/api/*` path
 * no route claimed is a machine request: it answers the one JSON 404 body
 * every API road answers, before a page route can take it.
 */
const mountSiteStack = async (
  honoWithApi: Readonly<Hono>,
  config: AppConfig,
  { getSession, endedSession }: AuthContext
): Promise<Readonly<Hono>> => {
  const { app } = config
  return setupPageRoutes(
    answerUnmatchedApiPaths(app)(
      setupRedirectRoutes(
        // The anonymous design-system share reader ([internal ref] A3 Part 2) sits in
        // the SAME slot as `/l/:token` and for the same reason: after the static
        // assets, before `setupPageRoutes`, whose `/:lang/*` route would match
        // `/s/...` and render a terminal 404 rather than calling `next()`.
        // `/oauth/consent` takes the same slot for the same reason. Better Auth
        // redirects the browser here mid-authorization; mounted after the page
        // routes, that redirect would land on `/:lang/*`'s terminal 404.
        setupOauthConsentRoutes(
          setupDesignSystemShareRoutes(
            setupLinkRoutes(
              setupDevReloadRoute(
                await setupStaticAssets(
                  setupSeoRoutes(honoWithApi, app, config.fetchSitemapRecords),
                  app,
                  config.publicDir,
                  Context.get(config.domainContext, AssetStore).realpaths
                ),
                config.staticRender !== true && isLiveReloadEligible()
              ),
              app
            ),
            app
          ),
          app,
          getSession
        ),
        app
      )
    ),
    // Inject getSession into config for page route handlers.
    //
    // `adminMounts` rides the same vector for the same reason, added in W5c:
    // resolving where the console sits decodes an embedded build artifact
    // (infrastructure), while the two routes that read the answer — the mount's
    // own registration and the URL canonicalizer, which must not rewrite paths
    // inside a mount — are presentation. This is the one place already
    // permitted to hold both. Resolved ONCE here rather than per request, which
    // is also what stops the canonicalizer rebuilding its reserved-prefix list
    // on every request through two `use('*')` handlers.
    { ...config, getSession, endedSession, adminMounts: adminMountsFor(app) },
    // The console's mount registrar, supplied rather than imported — see
    // `MountRegistrar` in `page-routes.ts`. Its chain POSITION is unchanged;
    // only the import moved, onto the one file already permitted to hold it.
    setupAdminMountRoutes
  )
}

/**
 * Creates the Hono application, phase by phase. The phase ORDER is the
 * contract: guards, request middleware, bootstrap, API stack, site stack,
 * error boundary.
 */
export async function createHonoApp(config: AppConfig): Promise<Readonly<Hono>> {
  const { app, renderNotFoundPage, renderErrorPage, configHash } = config

  const authContext = await resolveAuthContext(app, config.domainContext)

  const guarded = mountGuardChain(new Hono(), {
    app,
    domainContext: config.domainContext,
    renderNotFoundPage,
    notFoundBody,
    crossSiteGuardFor: crossSiteRequestGuard,
  })
  const honoWithLogger = mountRequestMiddleware(guarded, app, configHash)

  // Bootstrap claim route — mounted unconditionally; handler returns 404
  // when not in bootstrap mode. Mounted FIRST so it intercepts before
  // the auth-routes middleware sees it as an admin path.
  const honoWithBootstrap = setupBootstrapRoutes(honoWithLogger, app)

  const honoWithApi = mountApiStack(honoWithBootstrap, config, authContext)
  const honoWithRoutes = await mountSiteStack(honoWithApi, config, authContext)

  return attachErrorBoundary(honoWithRoutes, {
    app,
    renderNotFoundPage,
    renderErrorPage,
    notFoundBody,
  })
}
