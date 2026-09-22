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
    // The console root's companion attention read. An exact path with no
    // sub-segments, so it needs no `/*` partner — but it does need THIS pair,
    // and both halves of it: a `requireAdminTier` with no `authMiddleware` ahead
    // of it runs against a context no session was attached to and answers 404 to
    // every caller, the admin included (see the `/type-ladder` note below, which
    // is that bug's headstone). The payload is an inventory of where this
    // instance is weak — which variables are unset, which tokens expired, how
    // many invitations are outstanding — so a 401/403 would confirm that map
    // exists to whoever probes for it.
    .use('/api/admin/attention', authMiddleware(auth))
    .use('/api/admin/attention', requireAdminTier(resolveAppForTier))
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
    // [internal ref] A6: the decisions register read. The EXACT path, never a `/*`
    // wildcard — Hono needs at least one segment to match `/*`, and
    // `/api/admin/decisions` is the only URL that surface serves, so a
    // wildcard-only entry would leave it open to an anonymous caller.
    .use('/api/admin/decisions', authMiddleware(auth))
    .use('/api/admin/decisions', requireAdminTier(resolveAppForTier))
    // [internal ref] A6: the boot ledger. BOTH spellings, and neither substitutes for
    // the other — Hono needs at least one segment to match `/*`, so the
    // wildcard alone would leave the segment-less LIST open to an anonymous
    // caller, while the bare path alone would leave the per-boot detail read
    // open. `[internal ref]` asserts the list path for that reason.
    .use('/api/admin/releases', authMiddleware(auth))
    .use('/api/admin/releases', requireAdminTier(resolveAppForTier))
    .use('/api/admin/releases/*', authMiddleware(auth))
    .use('/api/admin/releases/*', requireAdminTier(resolveAppForTier))
    // The four Developers reads: the instance facts, the exposed MCP
    // tools, and the reflection record + declaration rows the Schema page reads.
    // Same A1 gate as the two reflections above, and EXPLICIT rather than left
    // to the catch-all for the reason the `/api/admin/schema/*` entries below
    // record: `/api/admin/instance` and `/api/admin/mcp/*` are new namespaces,
    // and an ungated sibling inside a guarded one is how a gap starts. Which
    // tools an instance exposes to an AI is a map of its write surface, so the
    // 404 matters here as much as anywhere in the group.
    .use('/api/admin/instance', authMiddleware(auth))
    .use('/api/admin/instance', requireAdminTier(resolveAppForTier))
    .use('/api/admin/mcp/*', authMiddleware(auth))
    .use('/api/admin/mcp/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/config/reflection', authMiddleware(auth))
    .use('/api/admin/config/reflection', requireAdminTier(resolveAppForTier))
    .use('/api/admin/config/declarations', authMiddleware(auth))
    .use('/api/admin/config/declarations', requireAdminTier(resolveAppForTier))
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
    // The class-provenance read. It needs its OWN entry for the reason `/shares`
    // just gave: the `design-system.*` entries above are exact paths with no
    // wildcard, so nothing under `/design-system/` inherits a gate from them.
    .use('/api/admin/design-system/provenance', authMiddleware(auth))
    .use('/api/admin/design-system/provenance', requireAdminTier(resolveAppForTier))
    // The five FACET reads (jalon 5.2b): the operator's own tokens, sentences,
    // declaration ledger, export sizes and per-type usage. Each needs its OWN
    // entry for the reason `/provenance` just gave — the `design-system.*`
    // exports above are exact paths with no wildcard, so nothing under
    // `/design-system/` inherits a gate from them. And each is an exact path
    // with no sub-segments of its own, so none needs a `/*` partner.
    //
    // Their payloads are narrower than the exports they sit beside, but the gate
    // is the same one and for the same reason: a 401/403 would confirm that this
    // instance publishes a projection of its whole configuration to whoever gets
    // a session, which is itself a signal worth withholding.
    .use('/api/admin/design-system/tokens', authMiddleware(auth))
    .use('/api/admin/design-system/tokens', requireAdminTier(resolveAppForTier))
    // NOTHING BELONGS BETWEEN A PAIR, AND THIS IS WHAT IT COSTS. A stray
    // `requireAdminTier` for `/type-ladder` sat on the next line with no
    // `authMiddleware` ahead of it — that route's real pair is thirteen lines
    // down — so the tier check ran against a context no session had been
    // attached to and answered 404 to EVERY caller, the admin included. The
    // endpoint was unreachable from the day it shipped, and silently: an
    // anti-enumeration 404 given to an admin is byte-identical to the one the
    // route is supposed to give an anonymous caller, so the guard looked exactly
    // like a guard that worked. `[internal ref]` reads the
    // ladder as a signed-in admin, which is what makes the difference visible.
    .use('/api/admin/design-system/guidance', authMiddleware(auth))
    .use('/api/admin/design-system/guidance', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/coverage', authMiddleware(auth))
    .use('/api/admin/design-system/coverage', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/exports', authMiddleware(auth))
    .use('/api/admin/design-system/exports', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/usage', authMiddleware(auth))
    .use('/api/admin/design-system/usage', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/brand', authMiddleware(auth))
    .use('/api/admin/design-system/brand', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/zones', authMiddleware(auth))
    .use('/api/admin/design-system/zones', requireAdminTier(resolveAppForTier))
    // The PLATFORM type ladder. A build constant rather than an operator fact,
    // and gated all the same: the console is admin-only whole, and a read that
    // answered anonymously would advertise which paths the console mounts.
    .use('/api/admin/design-system/type-ladder', authMiddleware(auth))
    .use('/api/admin/design-system/type-ladder', requireAdminTier(resolveAppForTier))
    // The component-type schema reads (catalogue + per-type detail). BOTH lines
    // are needed — Hono requires at least one segment to match `/*`, so the bare
    // catalogue path would fall through to the catch-all alone while `/:type`
    // needs the wildcard. Same pairing as `/api/admin/links` above.
    .use('/api/admin/schema/component-types', authMiddleware(auth))
    .use('/api/admin/schema/component-types', requireAdminTier(resolveAppForTier))
    .use('/api/admin/schema/component-types/*', authMiddleware(auth))
    .use('/api/admin/schema/component-types/*', requireAdminTier(resolveAppForTier))
    // The FIELD-type catalogue — a sibling read under `/schema/`, not under
    // `/schema/component-types/`, so it inherits neither line above and needs
    // its own pair. One path, no `/*`: there is no per-field-type detail route.
    .use('/api/admin/schema/field-types', authMiddleware(auth))
    .use('/api/admin/schema/field-types', requireAdminTier(resolveAppForTier))
    .use('/api/admin/roles', authMiddleware(auth))
    .use('/api/admin/roles', requireAdminTier(resolveAppForTier))
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
    // The Organisation page's access-graph read
    //. `/api/admin/organisation` is a
    // NEW namespace, so it gets an explicit entry rather than being left to the
    // defense-in-depth catch-all — an ungated sibling inside a guarded
    // namespace is how a gap starts, and the entries above record what that has
    // already cost once. The `/*` wildcard is what matches `/organisation/graph`;
    // the bare path serves nothing today, and adding it would gate a URL that
    // does not exist.
    //
    // The payload is a map of who can reach what in this instance, which is
    // precisely the thing a 401 or a 403 must not confirm the existence of.
    .use('/api/admin/organisation/*', authMiddleware(auth))
    .use('/api/admin/organisation/*', requireAdminTier(resolveAppForTier))
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
    // The console root's companion attention read — the no-auth mirror. One
    // line, not two: there is no auth instance to attach a session with.
    .use('/api/admin/attention', requireAdminTier(resolveAppForTier))
    // The four Developers reads — the no-auth mirror. See the
    // auth-enabled branch for why each needs an explicit entry rather than
    // inheriting from the defense-in-depth catch-all.
    .use('/api/admin/instance', requireAdminTier(resolveAppForTier))
    .use('/api/admin/mcp/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/config/reflection', requireAdminTier(resolveAppForTier))
    .use('/api/admin/config/declarations', requireAdminTier(resolveAppForTier))
    // Design-system share endpoints ([internal ref] A3 Part 2) — the no-auth mirror.
    // See the auth-enabled branch above for why these need explicit entries
    // rather than inheriting from the `/api/admin/design-system.*` exports.
    .use('/api/admin/design-system/shares', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/shares/*', requireAdminTier(resolveAppForTier))
    // The schema reads (jalon 5.2) — the no-auth mirror. See the auth-enabled
    // branch for why each needs an explicit entry rather than inheriting.
    .use('/api/admin/design-system/provenance', requireAdminTier(resolveAppForTier))
    .use('/api/admin/schema/component-types', requireAdminTier(resolveAppForTier))
    .use('/api/admin/schema/component-types/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/schema/field-types', requireAdminTier(resolveAppForTier))
    // The five facet reads (jalon 5.2b) — the no-auth mirror. See the
    // auth-enabled branch for why each needs an explicit entry rather than
    // inheriting from the `/api/admin/design-system.*` exports.
    .use('/api/admin/design-system/tokens', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/guidance', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/coverage', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/exports', requireAdminTier(resolveAppForTier))
    .use('/api/admin/design-system/usage', requireAdminTier(resolveAppForTier))
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
    // [internal ref] A6: the decisions register read. The EXACT path, never a `/*`
    // wildcard — Hono needs at least one segment to match `/*`, and
    // `/api/admin/decisions` is the only URL that surface serves, so a
    // wildcard-only entry would leave it open to an anonymous caller.
    .use('/api/admin/decisions', requireAdminTier(resolveAppForTier))
    // [internal ref] A6: the boot ledger — the no-auth mirror of the pair above, and
    // both spellings for the same reason.
    .use('/api/admin/releases', requireAdminTier(resolveAppForTier))
    .use('/api/admin/releases/*', requireAdminTier(resolveAppForTier))
    .use('/api/admin/links', requireAdminTier(resolveAppForTier))
    .use('/api/admin/links/*', requireAdminTier(resolveAppForTier))
    // The Organisation page's access-graph read — the no-auth mirror. One line,
    // not two: there is no auth instance to attach a session with. See the
    // auth-enabled branch for why the namespace gets an explicit entry.
    .use('/api/admin/organisation/*', requireAdminTier(resolveAppForTier))
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
