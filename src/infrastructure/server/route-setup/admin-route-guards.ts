/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The complete `/api/admin/*` guard registry — BOTH mirrors, side by side.
 *
 * This is the file a security reviewer opens to answer "what is guarded, and
 * how". It was split out of `api-routes.ts` for exactly that reason: the guard
 * list is not merely long, it is DOUBLED. Every admin path has to be gated
 * twice — once for an app that configures `app.auth`, and once for an app that
 * does not — and in `api-routes.ts` those two mirrors sat ~200 lines apart at
 * opposite ends of a 1000-line file.
 *
 * That distance is not hypothetical harm. It has already shipped a hole: the
 * no-auth branch lacked the `/api/admin/*` catch-all, so every admin sub-path
 * without its own explicit entry answered **200 to anonymous callers** on a
 * no-auth app (`/api/admin/users`, `/api/admin/config/version`,
 * `/api/admin/tables/overview`), and `/api/admin/buckets/:name/files` threw a
 * 500 dereferencing the session its handler assumed a gate had guaranteed. The
 * fix is preserved verbatim below; keeping the two mirrors adjacent is what
 * makes the next omission visible instead of invisible.
 *
 * ─── THE INVARIANT ──────────────────────────────────────────────────────────
 *
 * Adding an admin route means adding it to BOTH functions in this file. The
 * auth-enabled mirror needs `authMiddleware(auth)` to attach the session before
 * the tier check; the no-auth mirror has no session to attach and registers the
 * tier guard alone. Neither mirror may be left behind.
 *
 * ─── WHY `requireAdminTier` IS NOT CHAINED AFTER `requireAuth` ──────────────
 *
 * `requireAdminTier` answers **404** for a missing session AND for a wrong-role
 * caller, which is the S1 anti-enumeration contract: a 401 or 403 would confirm
 * the route exists to whoever probes it. Chaining `requireAuth()` in front would
 * short-circuit with 401 before the tier check could mask the route, so it is
 * deliberately absent everywhere except the two `/api/admin/storage/*` paths,
 * which predate the tier model and keep their `requireAuth` + `requireAdmin`
 * pairing.
 *
 * ─── ORDER IS LOAD-BEARING ─────────────────────────────────────────────────
 *
 * Hono runs middleware in registration order, so the `/api/admin/*` catch-all is
 * registered LAST in both mirrors. That way it never overrides the per-endpoint
 * 401-vs-404 semantics of the specific guards above it (which short-circuit
 * first for every known path) while still gating any admin sub-path whose own
 * `.use(...)` line is ever forgotten. Do not reorder these chains.
 */

import {
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireAdminTier,
} from '@/presentation/api/middleware/auth'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { ContextVariableMap, Hono } from 'hono'

/* eslint-disable functional/prefer-immutable-types -- Hono app types are mutable by library design; both guard chains take and return the same third-party `Hono` instance, matching the sibling helpers in `api-routes.ts`. */

/**
 * The Hono instance type at the point the admin guards are registered.
 *
 * By then the chain has already had `authMiddleware` applied upstream, which
 * widens Hono's env with `ContextVariableMap` (the session variables). Both the
 * auth-enabled and the no-auth arm converge on this same type, so one alias
 * serves both mirrors and the chain type flows through the call sites unchanged.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors Hono's own env widening verbatim; narrowing to `unknown` breaks assignability at the call site
type SessionHono = Hono<{ Variables: ContextVariableMap & Record<string, any> }>

type AuthInstance = Readonly<ReturnType<typeof createAuthInstance>>

/** Resolves the live App so a custom top role resolves to `admin-editor` (F6). */
type ResolveTierApp = () => App

/**
 * Register every `/api/admin/*` guard for an app that CONFIGURES `app.auth`.
 *
 * `authMiddleware(auth)` attaches the Better Auth session; the tier guard then
 * decides. Mirrored by `chainAdminRouteGuardsWithoutAuth` below.
 */
export const chainAdminRouteGuards = (
  honoApp: SessionHono,
  auth: AuthInstance,
  resolveAppForTier: ResolveTierApp
): SessionHono =>
  honoApp
    .use('/api/admin/storage/status', authMiddleware(auth))
    .use('/api/admin/storage/status', requireAuth())
    .use('/api/admin/storage/status', requireAdmin(resolveAppForTier))
    // Admin-tier endpoints — `requireAdminTier` enforces the anti-
    // enumeration 404 for both missing-session and wrong-role callers,
    // so `requireAuth` is intentionally NOT chained (it would short-
    // circuit with 401 before the tier check could mask the route).
    .use('/api/admin/buckets/overview', authMiddleware(auth))
    .use('/api/admin/buckets/overview', requireAdminTier(resolveAppForTier))
    // Admin-tier per-bucket file browser.
    // The wildcard covers `/api/admin/buckets/:name/files`; the bare-list
    // and overview paths above carry their own gates (middleware stacks).
    .use('/api/admin/buckets/*', authMiddleware(auth))
    .use('/api/admin/buckets/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/buckets', authMiddleware(auth))
    .use('/api/admin/buckets', requireAdminTier(resolveAppForTier))
    // Admin-tier forms catalog + submissions endpoints. Wildcards cover
    // both the bare list/detail (`/api/admin/forms`, `/api/admin/forms/:name`)
    // and the nested submissions paths (`.../submissions`,
    // `.../submissions/:id`, `.../submissions/_bulk`).
    .use('/api/admin/forms', authMiddleware(auth))
    .use('/api/admin/forms', requireAdminTier(resolveAppForTier))
    .use('/api/admin/forms/*', authMiddleware(auth))
    .use('/api/admin/forms/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/audit-log', authMiddleware(auth))
    .use('/api/admin/audit-log', requireAdminTier(resolveAppForTier))
    .use('/api/admin/config/version', authMiddleware(auth))
    .use('/api/admin/config/version', requireAdminTier(resolveAppForTier))
    // Config-introspection reads authorised by [internal ref] amendment A1: the
    // App-schema reflection and the declared-env viewer. `requireAdminTier`
    // 404s missing-session AND wrong-role callers (S1) — a 401/403 would
    // confirm that this instance publishes its whole configuration (and an
    // inventory of the credentials it expects) to whoever gets a session,
    // which is itself a signal worth withholding.
    .use('/api/admin/config/schema', authMiddleware(auth))
    .use('/api/admin/config/schema', requireAdminTier(resolveAppForTier))
    .use('/api/admin/env', authMiddleware(auth))
    .use('/api/admin/env', requireAdminTier(resolveAppForTier))
    // The design-system exports ([internal ref] amendment A2). Same gate as the two
    // reflections above and for the same reason: the document is a whole
    // projection of how this app looks, and a 401/403 would confirm the
    // instance publishes one to whoever gets a session.
    .use('/api/admin/design-system.json', authMiddleware(auth))
    .use('/api/admin/design-system.json', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system.md', authMiddleware(auth))
    .use('/api/admin/design-system.md', requireAdminTier(resolveAppForTier))
    // The component catalog's fixture rows. Same gate: the payload is a
    // platform constant, but the ROUTE is part of the admin design surface and
    // an ungated sibling inside a guarded namespace is how a gap starts.
    .use('/api/admin/design-system/specimen-rows', authMiddleware(auth))
    .use('/api/admin/design-system/specimen-rows', requireAdminTier(resolveAppForTier))
    // The design-system share endpoints ([internal ref] amendment A3 Part 2): mint,
    // list and revoke. BOTH lines are needed — Hono requires at least one
    // segment to match `/*`, so the bare `/shares` path (list + mint) would
    // fall through to the catch-all alone while `DELETE /shares/:id` needs the
    // wildcard. Same pairing as `/api/admin/links` above.
    //
    // These have no guard by inheritance: the three `design-system` entries
    // above are EXACT paths with no wildcard, and the `/_admin` console page
    // gates itself through `resolveCallerHasAccess` rather than through this
    // middleware. A3 widens exactly ONE surface to anonymous — the `/s/`
    // reader — and mint, revoke and list are emphatically not it: a build that
    // opened the reader by opening the namespace would hand every visitor the
    // ability to publish the operator's design system.
    .use('/api/admin/design-system/shares', authMiddleware(auth))
    .use('/api/admin/design-system/shares', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/shares/*', authMiddleware(auth))
    .use('/api/admin/design-system/shares/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/tables/overview', authMiddleware(auth))
    .use('/api/admin/tables/overview', requireAdminTier(resolveAppForTier))
    .use('/api/admin/footprint/overview', authMiddleware(auth))
    .use('/api/admin/footprint/overview', requireAdminTier(resolveAppForTier))
    // Admin-tier automations endpoints (overview + runs list/detail).
    // Wildcard covers /api/admin/automations/overview, /api/admin/automations/runs,
    // and /api/admin/automations/runs/:runId.
    .use('/api/admin/automations', authMiddleware(auth))
    .use('/api/admin/automations', requireAdminTier(resolveAppForTier))
    .use('/api/admin/automations/*', authMiddleware(auth))
    .use('/api/admin/automations/*', requireAdminTier(resolveAppForTier))
    // Admin-tier users overview.
    // requireAdminTier 404s for missing-session AND wrong-role callers
    // per keystone §6.4 (anti-enumeration), so the route surface stays
    // hidden from non-admin-tier traffic.
    .use('/api/admin/users/overview', authMiddleware(auth))
    .use('/api/admin/users/overview', requireAdminTier(resolveAppForTier))
    // Bare users-directory path. The
    // `GET /api/admin/users` account directory reads the auth `user` table
    // directly (decoupled from Better Auth's literal-`admin` plugin gate),
    // so a custom top-role operator reaches it. Hono needs at least one
    // segment to match `/*`, so the segment-less bare path needs its own
    // gate; mirrors how the bare `/api/admin/connections` sits beside the
    // `/api/admin/connections/*` wildcard. `requireAdminTier` 404s
    // missing-session AND non-admin callers (S1 anti-enumeration).
    .use('/api/admin/users', authMiddleware(auth))
    .use('/api/admin/users', requireAdminTier(resolveAppForTier))
    // Admin read surfaces for agents + connections. `requireAdminTier` 404s
    // missing-session AND non-admin callers (S1 anti-enum); the handlers add
    // the per-resource unknown-name 404. The `/*` wildcards cover the agent
    // conversations transcript viewer (`/api/admin/agents/:name/conversations`)
    // and the connections directory detail (`/api/admin/connections/:id`).
    // These admin read paths are distinct from the schema-author-facing
    // `/api/agents/*` and `/api/connections/*` runtime routes (which carry
    // their own per-(scope,role) gates).
    .use('/api/admin/agents/*', authMiddleware(auth))
    .use('/api/admin/agents/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/connections/*', authMiddleware(auth))
    .use('/api/admin/connections/*', requireAdminTier(resolveAppForTier))
    // Bare connection-list path. Hono
    // requires at least one segment to match `/*`, so the segment-less
    // `/api/admin/connections` list endpoint needs its own gate; mirrors
    // how `/api/admin/buckets` (bare) sits beside `/api/admin/buckets/*`.
    .use('/api/admin/connections', authMiddleware(auth))
    .use('/api/admin/connections', requireAdminTier(resolveAppForTier))
    // Short-link console ([internal ref]-*). BOTH the bare list path and the
    // `/*` wildcard are needed: Hono requires at least one segment to match
    // `/*`, so `/api/admin/links` (list + create) would fall through to the
    // catch-all alone, while `/api/admin/links/:slug` and the
    // `/:slug/{enable,disable}` state routes need the wildcard. Same pairing as
    // `/api/admin/buckets` and `/api/admin/connections` above.
    .use('/api/admin/links', authMiddleware(auth))
    .use('/api/admin/links', requireAdminTier(resolveAppForTier))
    .use('/api/admin/links/*', authMiddleware(auth))
    .use('/api/admin/links/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/storage/transform-cache', authMiddleware(auth))
    .use('/api/admin/storage/transform-cache', requireAuth())
    .use('/api/admin/storage/transform-cache', requireAdmin(resolveAppForTier))
    // Defense-in-depth catch-all (S1). Every `/api/admin/*` path above carries
    // its own explicit guard; this final wildcard ensures any future or
    // currently-unlisted admin sub-path is still gated by `requireAdminTier`
    // (anti-enumeration 404 for both missing-session AND non-admin callers)
    // rather than shipping open if its specific `.use(...)` line is ever
    // forgotten. Registered LAST so it never overrides the per-endpoint
    // 401-vs-404 semantics of the specific guards above (which short-circuit
    // first for every known path).
    .use('/api/admin/*', authMiddleware(auth))
    .use('/api/admin/*', requireAdminTier(resolveAppForTier))

/**
 * Register every `/api/admin/*` guard for an app with NO `app.auth`.
 *
 * The exact mirror of `chainAdminRouteGuards` above, minus the
 * `authMiddleware(auth)` lines — there is no auth instance to extract a session
 * with. The admin dashboard itself already 404s without auth, so nothing
 * legitimate reaches these routes here; the guards exist so that nothing
 * ILLEGITIMATE does either.
 */
export const chainAdminRouteGuardsWithoutAuth = (
  honoApp: SessionHono,
  resolveAppForTier: ResolveTierApp
): SessionHono =>
  honoApp
    .use('/api/admin/storage/status', requireAuth())
    .use('/api/admin/storage/status', requireAdmin(resolveAppForTier))
    .use('/api/admin/buckets/overview', requireAdminTier(resolveAppForTier))
    .use('/api/admin/buckets', requireAdminTier(resolveAppForTier))
    .use('/api/admin/forms', requireAdminTier(resolveAppForTier))
    .use('/api/admin/forms/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/audit-log', requireAdminTier(resolveAppForTier))
    // Design-system share endpoints ([internal ref] A3 Part 2) — the no-auth mirror.
    // See the auth-enabled branch above for why these need explicit entries
    // rather than inheriting from the `/api/admin/design-system.*` exports.
    .use('/api/admin/design-system/shares', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/shares/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/footprint/overview', requireAdminTier(resolveAppForTier))
    .use('/api/admin/automations', requireAdminTier(resolveAppForTier))
    .use('/api/admin/automations/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/users/overview', requireAdminTier(resolveAppForTier))
    // Admin read surfaces for agents (conversations) + connections (list/detail).
    .use('/api/admin/agents/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/connections/*', requireAdminTier(resolveAppForTier))
    // Bare connection-list path — the
    // `/*` wildcard does not cover the segment-less list path.
    .use('/api/admin/connections', requireAdminTier(resolveAppForTier))
    // Short-link console ([internal ref]-*). BOTH the bare list path and the
    // `/*` wildcard are needed: Hono requires at least one segment to match
    // `/*`, so `/api/admin/links` (list + create) would fall through to the
    // catch-all alone, while `/api/admin/links/:slug` and the
    // `/:slug/{enable,disable}` state routes need the wildcard. Same pairing as
    // `/api/admin/buckets` and `/api/admin/connections` above.
    .use('/api/admin/links', requireAdminTier(resolveAppForTier))
    .use('/api/admin/links/*', requireAdminTier(resolveAppForTier))
    // Defense-in-depth catch-all (S1) — the no-auth mirror of the
    // `/api/admin/*` line in the branch above. Without it, every admin
    // sub-path that lacks its own `.use(...)` entry here ships OPEN when
    // `app.auth` is absent: `/api/admin/users`, `/api/admin/config/version`
    // and `/api/admin/tables/overview` answered 200 to anonymous callers,
    // and `/api/admin/buckets/:name/files` threw a 500 dereferencing the
    // session its handler assumes the gate guaranteed. The admin dashboard
    // itself already 404s without auth, so nothing legitimate reaches these
    // routes on a no-auth app. Registered LAST so the `requireAuth()` 401s
    // on `/api/admin/storage/*` above keep short-circuiting first.
    .use('/api/admin/*', requireAdminTier(resolveAppForTier))
