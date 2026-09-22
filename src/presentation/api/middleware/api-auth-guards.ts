/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every middleware an `/api/*` request passes before it reaches a handler,
 * in the ONE order that is the contract: transport guards, then rate limits,
 * then session extraction, then the per-path authorisation gates.
 *
 * Kept beside `admin-route-guards.ts` and applied as a single call from the
 * chain, so that adding a route can never silently land upstream of a gate.
 */

import {
  chainAdminRouteGuards,
  chainAdminRouteGuardsWithoutAuth,
} from '@/presentation/api/middleware/admin-route-guards'
import {
  authMiddleware,
  requireAdmin,
  requireAuth,
  requireAuthOrGuestComment,
} from '@/presentation/api/middleware/auth'
import {
  applyActivityRateLimitMiddleware,
  applyRequestGuards,
  applyTablesRateLimitMiddleware,
} from '@/presentation/api/middleware/request-guards'
import { getLiveApp } from '@/presentation/api/runtime/live-app-store'
import { sharedViewsRateLimitMiddleware } from '@/presentation/api/tables/shared-view-rate-limit'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Hono } from 'hono'

export const applyApiAuthGuards = (
  honoWithHealth: Hono,
  app: App,
  auth?: Readonly<ReturnType<typeof createAuthInstance>>
) => {
  // Apply request timeout + body-size guards before rate limiting / auth so
  // oversized or slow requests are rejected as early as possible.
  // (Streaming routes are exempted from the timeout — see applyRequestGuards.)
  const honoWithGuards = applyRequestGuards(honoWithHealth)

  // Apply rate limiting middleware BEFORE auth middleware
  // This prevents auth bypass by rate limiting all requests first
  // Middleware order: rate limiting → authMiddleware (extracts session) → requireAuth (enforces auth)
  const honoWithTablesRateLimit = applyTablesRateLimitMiddleware(honoWithGuards)
  const honoWithActivityRateLimit = applyActivityRateLimitMiddleware(honoWithTablesRateLimit)

  // Apply auth middleware to protected routes
  // This extracts session from Better Auth and attaches to context
  // Activity endpoints ALWAYS require authentication (even when app.auth is not configured)
  // Table endpoints only require authentication if auth is configured
  // Analytics query endpoints require admin role; collect endpoint is public
  //
  // PG-02 guest-comment exemption: `/api/tables/*` uses `requireAuthOrGuestComment`
  // which permits unauthenticated `POST /api/tables/:tableId/records/:recordId/comments`
  // when the resolved table has `comments.guestComments: true`. Every other
  // `/api/tables/*` path still gets the normal 401-on-no-session contract.
  // The bare `/api/tables` list endpoint stays under `requireAuth()` — it
  // returns the table catalog which is never public.
  const resolveAppForGuestCommentExemption = (): App => (getLiveApp() as App | undefined) ?? app
  // F6 dashboard-tier model: thread the live App into the admin-route tier
  // guards so a custom top role (e.g. partner's `engineer`) resolves to
  // `admin-editor` implicitly. Reads the published live App when present
  //, falling back to the boot `app`.
  const resolveAppForTier = (): App => (getLiveApp() as App | undefined) ?? app
  // A form with a custom `path` answers on a second, arbitrary URL that no
  // wildcard below covers (`/forms/*` and `/api/forms/*` miss e.g.
  // `/partner-order`). Without the session attached there, every caller
  // looks anonymous to that route's access gate — so the gate would deny
  // exactly the users it exists to admit, and `$user.*` prefills would
  // render empty.
  //
  // Each path is mounted individually rather than via `.use('/*')`, which
  // would run Better Auth's session lookup on every static asset. That is
  // safe to do because `FormPathSchema` forbids `*` and `:`, so every
  // declared path is a literal, exact-match route.
  const honoWithFormPathAuth = auth
    ? (app.forms ?? []).reduce<typeof honoWithActivityRateLimit>(
        (acc, form) =>
          typeof form.path === 'string'
            ? (acc.use(form.path, authMiddleware(auth)) as typeof honoWithActivityRateLimit)
            : acc,
        honoWithActivityRateLimit
      )
    : honoWithActivityRateLimit
  const honoWithPreAdminGuards = auth
    ? honoWithFormPathAuth
        .use('/api/tables', authMiddleware(auth))
        .use('/api/tables', requireAuth())
        .use('/api/tables/*', authMiddleware(auth))
        .use('/api/tables/*', requireAuthOrGuestComment(resolveAppForGuestCommentExemption))
        // Cycle 6 ([internal ref]..026): shared-view lookup-by-id.
        // Mounted at a sibling path to `/api/tables/*` because the lookup is
        // cross-table-by-design — any authenticated user can fetch a saved
        // view IFF the table the view binds to grants them read permission.
        // The handler enforces that gate; the middleware here just ensures
        // we have a session to evaluate against.
        .use('/api/shared-views/*', authMiddleware(auth))
        .use('/api/shared-views/*', requireAuth())
        .use('/api/shared-views/*', sharedViewsRateLimitMiddleware)
        .use('/api/activity', authMiddleware(auth))
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', authMiddleware(auth))
        .use('/api/activity/*', requireAuth())
    : honoWithActivityRateLimit
        .use('/api/activity', requireAuth())
        .use('/api/activity/*', requireAuth())

  // Every `/api/admin/*` guard lives in `admin-route-guards.ts` — BOTH mirrors
  // (auth-enabled and no-auth) side by side in one purpose-named file, so an
  // admin route can never be added to one and silently missed in the other.
  // That omission has shipped a hole before; see the module doc there.
  //
  // Applied at exactly this point in the chain, between the activity guards and
  // the analytics guards, so the registration order of every guard is unchanged
  // from when these two blocks were inlined here.
  const honoWithAdminGuards = auth
    ? chainAdminRouteGuards(honoWithPreAdminGuards, auth, resolveAppForTier)
    : chainAdminRouteGuardsWithoutAuth(honoWithPreAdminGuards, resolveAppForTier)

  const honoWithAuth = auth
    ? honoWithAdminGuards
        .use('/api/analytics/overview', authMiddleware(auth))
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/overview', requireAdmin(resolveAppForTier))
        .use('/api/analytics/pages', authMiddleware(auth))
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/pages', requireAdmin(resolveAppForTier))
        .use('/api/analytics/referrers', authMiddleware(auth))
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/referrers', requireAdmin(resolveAppForTier))
        .use('/api/analytics/devices', authMiddleware(auth))
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/devices', requireAdmin(resolveAppForTier))
        .use('/api/analytics/campaigns', authMiddleware(auth))
        .use('/api/analytics/campaigns', requireAuth())
        .use('/api/analytics/campaigns', requireAdmin(resolveAppForTier))
        .use('/api/analytics/events', authMiddleware(auth))
        // `/api/analytics/targets` takes the session but NOT `requireAuth` /
        // `requireAdmin`, exactly like `/events` above: its handler answers 404
        // for a missing session and for a non-admin, which is the S1
        // anti-enumeration contract. A `requireAuth` here would short-circuit
        // with 401 first and confirm the endpoint exists to a prober.
        .use('/api/analytics/targets', authMiddleware(auth))
        // Automations: extract session so manual triggers can resolve
        // the caller's role against trigger.requiredRole. Webhook triggers
        // remain anonymous-friendly — handlers gate per-trigger inside the
        // application layer rather than rejecting at the middleware.
        .use('/api/automations/*', authMiddleware(auth))
        // The bare `/api/automations` listing endpoint is NOT covered by
        // the `/*` wildcard above (Hono requires at least one segment to
        // match `/*`). Require authentication so the listing cannot be used
        // as an anonymous enumeration oracle for configured webhook
        // automations — secrets are already redacted by `handleListAutomations`,
        // but the trigger names + request/query schemas are still attacker-
        // useful when discovered by an unauthenticated probe.
        .use('/api/automations', authMiddleware(auth))
        .use('/api/automations', requireAuth())
        // Buckets: extract session so the handler can decide per-bucket whether
        // auth is required (public: false → 401 if no session, public: true →
        // serve the file directly). Do NOT chain requireAuth() — that would
        // reject public-bucket requests before they reach the handler.
        .use('/api/buckets/*', authMiddleware(auth))
        // Connections (OAuth2 / API key / etc.): extract session so handlers
        // can authorize per (connection.scope, role). The OAuth2 callback is
        // accessed by an authenticated browser session (the user who started
        // the authorize flow), so authMiddleware is required here. We do
        // NOT chain requireAuth() — handlers return 401 directly so the
        // 'connection not found' (404) and 'unauthorized' (401) responses
        // can be distinguished cleanly per spec.
        .use('/api/connections/*', authMiddleware(auth))
        // Forms: extract the session so the
        // form-route handlers can enforce the form's own `access.require`
        // gate (401 for `authenticated`, 404 for role denials) and capture
        // the submitter id on the ledger. Both the canonical render route
        // (`/forms/:name`) and the submission endpoint
        // (`/api/forms/:name/submissions`) need the session. We do NOT chain
        // requireAuth() — public forms must stay anonymous-friendly; the
        // per-form gate decides.
        .use('/forms/*', authMiddleware(auth))
        .use('/api/forms/*', authMiddleware(auth))
        // Active-scope session API (P-6): cookie-backed per-tableSlug
        // active assignment. Every handler re-validates the session, but
        // we still apply authMiddleware here so the existing session-
        // attached context helpers (`getSessionContext`) work uniformly.
        // Do NOT chain requireAuth() — the handlers return 401 directly so
        // 401 ('not signed in') and 404 ('scopeTables disabled') can be
        // distinguished cleanly.
        .use('/api/session/active-scope/:tableSlug', authMiddleware(auth))
        // Generic AI chat endpoint (cross-cutting). Always authenticated
        // when `app.auth` is configured — the
        // unauthenticated request must short-circuit to HTTP 401 before
        // the handler runs. The route itself is registered below by
        // `chainAiChatRoutes`.
        .use('/api/ai/chat', authMiddleware(auth))
        .use('/api/ai/chat', requireAuth())
        // Streaming variant — same auth contract (POST /api/ai/chat/stream).
        // Registered as a sibling route by `chainAiChatRoutes`; per
        // [internal ref] must accept JSON body + return 200 + SSE.
        .use('/api/ai/chat/stream', authMiddleware(auth))
        .use('/api/ai/chat/stream', requireAuth())
        // Conversation-history routes (durable AI chat memory,
        // [internal ref]) — list/get/delete a user's
        // conversation threads. Per-user scoping needs
        // the authenticated session, so both the bare path and the
        // `:sessionId` sub-paths get the auth chain.
        .use('/api/ai/conversations', authMiddleware(auth))
        .use('/api/ai/conversations', requireAuth())
        .use('/api/ai/conversations/*', authMiddleware(auth))
        .use('/api/ai/conversations/*', requireAuth())
        // Agent action + approval routes. authMiddleware extracts the session
        // so approval-decision handlers can RBAC-gate by role level. We do NOT
        // chain requireAuth() — the execute path runs without a session, and
        // the decision handlers return 401/403 directly so the spec can
        // distinguish unauthenticated from insufficient-role.
        .use('/api/agents/*', authMiddleware(auth))
        // Account self-service + GDPR routes (D3/D4/D5). authMiddleware
        // attaches the session so the export/delete handlers can read the
        // caller id and return 401 themselves. requireAuth is NOT chained:
        // `/api/account/purge-due` is an internal scheduler trigger and
        // runs without a session.
        .use('/api/account/*', authMiddleware(auth))
        // Favorites routes.
        // authMiddleware attaches the session so the per-user list/add/remove
        // handlers can scope every query to the caller's `userId`. The
        // handlers return 401 themselves when no session is attached, so
        // requireAuth is not chained.
        .use('/api/favorites', authMiddleware(auth))
        // User directory — the candidate source a `user` field's picker reads.
        // authMiddleware attaches the session; the handler returns 401 itself
        // when there is none, so requireAuth is not chained. Deliberately NOT
        // admin-tier: see the route module for why it is readable by every
        // signed-in account, and why its body carries no email.
        .use('/api/users/*', authMiddleware(auth))
        // Recent items + command-palette search
        //. authMiddleware
        // attaches the session so the per-user recent list and the
        // favorited-boost ranking can resolve the caller. Handlers tolerate a
        // missing session, so requireAuth is not chained.
        .use('/api/recent', authMiddleware(auth))
        .use('/api/command-search', authMiddleware(auth))
        // Realtime presence (Wave-6). authMiddleware attaches the session so
        // the presence SSE handler can resolve the caller's id + display
        // name. requireAuth is NOT chained — the handler returns 401 itself
        // so the SSE response shape stays under the handler's control.
        .use('/api/realtime/presence', authMiddleware(auth))
    : honoWithAdminGuards
        .use('/api/analytics/overview', requireAuth())
        .use('/api/analytics/overview', requireAdmin(resolveAppForTier))
        .use('/api/analytics/pages', requireAuth())
        .use('/api/analytics/pages', requireAdmin(resolveAppForTier))
        .use('/api/analytics/referrers', requireAuth())
        .use('/api/analytics/referrers', requireAdmin(resolveAppForTier))
        .use('/api/analytics/devices', requireAuth())
        .use('/api/analytics/devices', requireAdmin(resolveAppForTier))
        .use('/api/analytics/campaigns', requireAuth())
        .use('/api/analytics/campaigns', requireAdmin(resolveAppForTier))

  return honoWithAuth
}
