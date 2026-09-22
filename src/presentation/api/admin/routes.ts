/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `/api/admin/*` half of the API chain — one family, chained in one place.
 *
 * Extracted from the main chain because it is the half that grows: every new
 * operator console read adds a link here and nowhere else. Authorisation for
 * these paths is mounted upstream, in `api-auth-guards.ts`.
 */

import { resolveRequestBaseUrl } from '@/domain/kernel/url/request-base-url'
import { chainAdminAgentsRoutes } from '@/presentation/api/admin/agents-routes'
import { chainAdminAuditLogRoutes } from '@/presentation/api/admin/audit-log-routes'
import { chainAdminAutomationsRoutes } from '@/presentation/api/admin/automations-routes'
import { chainAdminBucketsRoutes } from '@/presentation/api/admin/buckets-routes'
import { chainAdminConfigIntrospectionRoutes } from '@/presentation/api/admin/config-introspection-routes'
import { chainAdminConnectionActionRoutes } from '@/presentation/api/admin/connection-action-routes'
import { chainAdminConnectionsRoutes } from '@/presentation/api/admin/connections-routes'
import { chainAdminDecisionsRoutes } from '@/presentation/api/admin/decisions-routes'
import { chainAdminDesignSystemFacetRoutes } from '@/presentation/api/admin/design-system-facet-routes'
import { chainAdminDesignSystemRoutes } from '@/presentation/api/admin/design-system-routes'
import { chainAdminDesignSystemSchemaRoutes } from '@/presentation/api/admin/design-system-schema-routes'
import { chainAdminDesignSystemShareRoutes } from '@/presentation/api/admin/design-system-share-routes'
import { chainAdminDeveloperReadRoutes } from '@/presentation/api/admin/developer-read-routes'
import { chainAdminFootprintRoutes } from '@/presentation/api/admin/footprint-routes'
import { chainAdminFormsAnalyticsExportRoutes } from '@/presentation/api/admin/forms-analytics-export-routes'
import { chainAdminFormsRoutes } from '@/presentation/api/admin/forms-routes'
import { chainAdminLinksRoutes } from '@/presentation/api/admin/links-routes'
import { chainAdminOrganisationRoutes } from '@/presentation/api/admin/organisation-routes'
import { chainAdminRoutes } from '@/presentation/api/admin/overview-routes'
import { chainAdminReleasesRoutes } from '@/presentation/api/admin/releases-routes'
import { chainAdminUsersRoutes } from '@/presentation/api/admin/users-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export const chainAdminApiRoutes = <T extends Hono>(
  honoWithForms: T,
  app: App,
  resolveLiveApp: () => App
) => {
  // Chain admin routes (storage status and other administrative inspectors).
  // Auth gating (admin-only) is applied above via authMiddleware → requireAuth
  // → requireAdmin on the matching route paths.
  const honoWithAdmin = chainAdminRoutes(honoWithForms, app)

  // Chain admin/buckets + admin/audit-log routes ([internal ref],
  // [internal ref]). Auth gating (admin + operator tier) is
  // applied above via authMiddleware → requireAuth → requireAdminTier on
  // /api/admin/buckets, /api/admin/buckets/overview, and /api/admin/audit-log.
  // `app` is threaded in so both endpoints enumerate the buckets the config
  // declares (`app.buckets[]`) rather than the single env-resolved backend.
  const honoWithAdminBuckets = chainAdminBucketsRoutes(honoWithAdmin, app)
  // Chain admin/forms routes — list/detail of `app.forms[]` + the form-
  // submissions sub-resource (list, detail, bulk). The route handler
  // resolves the live App via `resolveLiveApp` so a `POST /draft/publish`
  // is reflected without restart.
  //
  // F-04: the analytics+export routes register BEFORE the existing
  // `:submissionId` dynamic segment so `/submissions/export` resolves
  // to the export handler rather than being captured as a submission id.
  const honoWithAdminFormsAnalytics = chainAdminFormsAnalyticsExportRoutes(
    honoWithAdminBuckets,
    resolveLiveApp
  )
  const honoWithAdminForms = chainAdminFormsRoutes(honoWithAdminFormsAnalytics, resolveLiveApp)
  const honoWithAdminAuditLog = chainAdminAuditLogRoutes(honoWithAdminForms)

  // Chain the READ-ONLY projections of the running configuration — one family,
  // chained together because they are gated identically and answer the same
  // question at two levels of detail:
  // [internal ref] A1: the App-schema reflection (`/api/admin/config/schema`) and
  //               the declared-env viewer (`/api/admin/env`).
  // [internal ref] A2: the design-system exports (`/api/admin/design-system.json`
  //               and `.md`), both projecting `buildDesignSystem(app)` so the
  //               two formats cannot describe different systems.
  // Auth gating is applied above via authMiddleware → requireAdminTier on each
  // of the four paths. `resolveLiveApp` (not the boot `app`) throughout, so a
  // reload is reflected without a restart — an export describing the previous
  // deploy's palette is worse than no export, and that promise is the point.
  // [internal ref] A3: the design-system SHARE endpoints (mint / list / revoke).
  //               Their anonymous counterpart, `GET /s/design-system/{token}`,
  //               is a platform route registered in `server.ts` — these three
  //               are admin-guarded like every other A1/A2 surface, and their
  //               guard is EXPLICIT: `admin-route-guards.ts` lists the
  //               `/api/admin/design-system.*` exports as exact paths with no
  //               wildcard, so `/design-system/shares` inherits nothing.
  //   The SCHEMA reads of the same family: the component-type catalogue, one
  //               type's fields, and the class-provenance chain. Same gate, same
  //               live-App resolver, and same explicit-guard requirement — the
  //               `/api/admin/schema/*` namespace is new, so both mirrors of
  //               `admin-route-guards.ts` list it rather than leaving it to the
  //               defense-in-depth catch-all.
  //   The FACET reads of the same family: the operator's own tokens, the prose
  //               they declared, which layers they authored, what their exports
  //               weigh, and where their pages write a type. Same gate and same
  //               live-App resolver — and the live resolver matters more here
  //               than anywhere else in the group, because every one of these is
  //               a function of the operator's config rather than of the build.
  // [internal ref]: the four DEVELOPERS reads — the instance facts, the exposed MCP
  //               tools, and the reflection record + declaration rows. Same A1
  //               gate and same live-App resolver as their siblings above: each
  //               is a function of the operator's config, and the three console
  //               pages that read them are config rather than builders because
  //               of it.
  const honoWithAdminConfigReads = chainAdminDeveloperReadRoutes(
    // The origin resolver is injected rather than imported by the route module:
    // a presentation route may not reach into `infrastructure/server` for
    // behaviour, and writing a second resolver on that side is what the origin
    // contract forbids. This is the composition root, so it supplies the one
    // every printing surface already shares.
    chainAdminDesignSystemFacetRoutes(
      chainAdminDesignSystemSchemaRoutes(
        chainAdminDesignSystemShareRoutes(
          chainAdminDesignSystemRoutes(
            chainAdminReleasesRoutes(
              chainAdminDecisionsRoutes(
                chainAdminConfigIntrospectionRoutes(honoWithAdminAuditLog, resolveLiveApp),
                resolveLiveApp
              ),
              resolveLiveApp
            ),
            resolveLiveApp
          ),
          resolveLiveApp
        ),
        resolveLiveApp
      ),
      resolveLiveApp
    ),
    resolveLiveApp,
    resolveRequestBaseUrl
  )

  // Chain admin/footprint routes. Auth
  // gating (admin + operator tier) is applied above via
  // authMiddleware → requireAdminTier on /api/admin/footprint/overview.
  const honoWithAdminFootprint = chainAdminFootprintRoutes(honoWithAdminConfigReads, app)

  // Chain admin/automations routes (overview + runs list/detail). Auth gating
  // is applied above via authMiddleware → requireAdminTier on
  // /api/admin/automations + /api/admin/automations/*. The handlers resolve
  // the live App via `resolveLiveApp` so a `POST /draft/publish` is reflected
  // in the overview's `totals.automations` count without restart.
  const honoWithAdminAutomations = chainAdminAutomationsRoutes(
    honoWithAdminFootprint,
    resolveLiveApp
  )

  // Chain admin/users routes (overview tile). Auth gating is applied above
  // via authMiddleware → requireAdminTier on /api/admin/users/overview.
  // The handler reads exclusively from auth.user + auth.session — no live-App
  // dependency, so the resolver thunk is not threaded through.
  const honoWithAdminUsers = chainAdminUsersRoutes(honoWithAdminAutomations)

  // Chain admin agent-conversation read endpoints:
  // GET /api/admin/agents and /api/admin/agents/:name/conversations[/:id]. Shares
  // the `/api/admin/agents/*` wildcard (authMiddleware → requireAdminTier) with the
  // per-agent metrics endpoint below; the segment-less index is gated by the
  // trailing `/api/admin/*` catch-all. Resolves the live App via `resolveLiveApp`
  // for the `isConversationSourceAgent` anti-enum gate (reflects a
  // `POST /draft/publish`, [internal ref]).
  const honoWithAdminAgents = chainAdminAgentsRoutes(honoWithAdminUsers, resolveLiveApp)

  // Chain admin connection read endpoints:
  // GET /api/admin/connections[/:id]. Reads the RUNTIME DB rows in
  // `system.connections` + the per-connection token summary from
  // `system.connection_tokens` (NOT `app.connections` config), so no live-App
  // resolver is threaded. Auth gating is applied above via authMiddleware →
  // requireAdminTier on BOTH the `/api/admin/connections/*` wildcard and the
  // bare `/api/admin/connections` path. The single-segment `/:id` detail route
  // is the connections directory's only per-resource sub-path.
  const honoWithAdminConnections = chainAdminConnectionsRoutes(honoWithAdminAgents)

  // Chain admin connection ACTION endpoints: POST /api/admin/connections/:id/authorize, GET.../:name/callback,
  // POST .../:id/disconnect. The boot `app` is threaded in for the by-name
  // OAuth-props resolution (clientId/clientSecret/urls live in `app.connections`
  // config, not the runtime DB row). Auth gating is applied above via
  // authMiddleware → requireAdminTier on the `/api/admin/connections/*` wildcard
  // (admits the admin tier incl. a custom top role; 404s member/anon). The
  // two-segment action paths are distinct from the single-segment `/:id` detail
  // route registered above, so they never shadow it.
  const honoWithAdminConnectionActions = chainAdminConnectionActionRoutes(
    honoWithAdminConnections,
    app
  )

  // Chain the short-link console ([internal ref] / -MUTATIONS). The
  // catalog is a UNION of two populations — `app.links[]` entries resolved from
  // the file and `system.links` rows minted at runtime — so `resolveLiveApp`
  // (not the boot `app`) is threaded through: a reload that adds a config link
  // must reserve that slug against mutation on the next request, not the next
  // restart. Auth gating is applied above via authMiddleware → requireAdminTier
  // on BOTH the bare `/api/admin/links` path and the `/api/admin/links/*`
  // wildcard, which the `/:slug/{enable,disable}` state routes need.
  const honoWithAdminLinks = chainAdminLinksRoutes(honoWithAdminConnectionActions, resolveLiveApp)

  // Chain the Organisation page's one read:
  // GET /api/admin/organisation/graph. `resolveLiveApp` rather than the boot
  // `app`, because the graph's whole job is to explain the configuration the
  // server is CURRENTLY running — `tables`, `pages` and `buckets` hot-swap
  // outside the restart set, so a boot-config graph would describe the previous
  // deploy's permissions. Auth gating is applied above via
  // authMiddleware → requireAdminTier on `/api/admin/organisation/*` (404s
  // missing-session AND non-admin callers, S1 anti-enumeration).
  const honoWithAdminOrganisation = chainAdminOrganisationRoutes(honoWithAdminLinks, resolveLiveApp)

  return honoWithAdminOrganisation
}
