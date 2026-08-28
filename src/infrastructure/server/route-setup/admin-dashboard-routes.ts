/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Native Admin Dashboard system-config mount ([internal ref] runtime plumbing).
 *
 * The dashboard is DOGFOODED: a platform-provided system app config, embedded
 * in the binary (the `with { type: 'file' }` pattern, materialized via the
 * `isCompiled` path — NOT `isBundled`), is auto-mounted here at `/_admin` into
 * every booted app. It renders through the EXISTING page/component pipeline
 * (`config.renderPage`) like any config-driven page, but with the embedded
 * dashboard `App` — never the operator's `App`.
 *
 * Chicken-and-egg resolution ([internal ref] D1/D2): the dashboard config is a
 * platform-owned, embedded artifact DISTINCT from the operator's config/draft.
 * The operator can neither edit nor delete it, and a broken operator draft can
 * never brick `/_admin` because the mount sources exclusively from the embedded
 * config.
 *
 * Authorization (S1 anti-enumeration): every `/_admin` route is gated by a
 * single admin guard; anonymous / non-admin callers get a 404 (never 401/403).
 * The public carve-out is an EXACT-MATCH set of three paths — `/_admin/login`
 * plus the two password-recovery surfaces `/_admin/forgot-password` and
 * `/_admin/reset-password` — each reachable without a session so an operator who
 * cannot sign in still has a way back into their own console. Exact match, never
 * prefix: a `startsWith('/_admin/')` carve-out would expose the whole console,
 * and trailing-slash / case variants fall through to the 404 (fail closed).
 *
 * An already-authorized admin is redirected to `/_admin` from `/_admin/login`
 * and `/_admin/forgot-password` (nothing there for them). `/_admin/reset-password`
 * is deliberately EXEMPT from that redirect: bouncing a signed-in admin off it
 * would discard the emailed `?token=` and strand the reset half-finished.
 *
 * The two recovery paths are additionally gated on outgoing mail being
 * configured — with no SMTP they are omitted from the public set and 404 like
 * any other unreachable path, and the recovery link is pruned from the sign-in
 * card. "Is SMTP configured" is a deployment fact identical for every caller, so
 * gating on it leaks nothing about any user and S1 is untouched.
 *
 * Config is code-only: there is no runtime config-editing surface, so every
 * admin gets the same full access (no editor/viewer split, no schema-edit flag).
 */

import { Schema } from 'effect'
import { buildDashboardSurfaceApp } from '@/application/use-cases/admin/dashboard-surface-builder'
import {
  parseDesignSystemCatalogRoute,
  parseDesignSystemPreviewRoute,
} from '@/application/use-cases/admin/dashboard-surface-routes'
import { isDataObjectRedirect } from '@/application/use-cases/admin/dashboard-surfaces/data-object-rail'
import { AppSchema, isAdminEquivalent, isAdminTier } from '@/domain/models/app'
import { readEmbeddedDashboardConfig } from '@/infrastructure/assets/embedded-static-assets'
import { isEmailConfigured } from '@/infrastructure/email/email-config'
import { logError } from '@/infrastructure/logging/logger'
import { extractSurfaceContent, isPartialRequest } from './admin-dashboard-partial'
import { resolveRequestBaseUrl } from './resolve-base-url'
import type { HonoAppConfig } from './page-routes'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/** The route prefix the dashboard is auto-mounted at. */
const ADMIN_PREFIX = '/_admin'

/** The public sign-in card. */
const ADMIN_LOGIN_PATH = '/_admin/login'

/** The password-recovery request form (asks for an address, mails a link). */
const ADMIN_FORGOT_PASSWORD_PATH = '/_admin/forgot-password'

/** The password-recovery completion form (reached from the emailed link). */
const ADMIN_RESET_PASSWORD_PATH = '/_admin/reset-password'

/**
 * The public (unguarded) carve-out — exempt from the 404-anonymous gate.
 *
 * EXACT match only (`Set.has`), never a prefix test: `startsWith('/_admin/')`
 * would silently expose the entire console, and would let
 * `/_admin/reset-password/../{surface}`-shaped paths slip past the guard.
 * Trailing-slash and case variants are not members and therefore 404 — the same
 * failure mode as any unknown path.
 */
const ADMIN_PUBLIC_PATHS: ReadonlySet<string> = new Set([
  ADMIN_LOGIN_PATH,
  ADMIN_FORGOT_PASSWORD_PATH,
  ADMIN_RESET_PASSWORD_PATH,
])

/**
 * The public paths an ALREADY-SIGNED-IN admin is bounced off (302 → `/_admin`),
 * because there is nothing there for them (LOGIN-004).
 *
 * `/_admin/reset-password` is DELIBERATELY ABSENT. An operator who requested a
 * link and then remembered their password is a mundane, reachable state; the
 * redirect would swallow the `?token=` and leave them holding a link that
 * silently does nothing.
 */
const ADMIN_SIGNED_IN_REDIRECT_PATHS: ReadonlySet<string> = new Set([
  ADMIN_LOGIN_PATH,
  ADMIN_FORGOT_PASSWORD_PATH,
])

/**
 * Whether a path is reachable without a session.
 *
 * The sign-in card is public unconditionally — losing outgoing mail must never
 * cost the operator their way in. The recovery pair is public only while SMTP
 * is configured: a recovery form that can never mail anything is worse than no
 * form at all, so without mail it is absent rather than broken.
 */
const isPublicAdminPath = (path: string): boolean => {
  if (!ADMIN_PUBLIC_PATHS.has(path)) return false
  // Every public path other than the sign-in card is a recovery path.
  return path === ADMIN_LOGIN_PATH || isEmailConfigured()
}

/**
 * Memoized decoded dashboard `App`. The embedded config is version-locked to
 * the binary, so it is decoded once per process and reused for every request.
 *
 * The cache holds three states without a `null` sentinel:
 *  - `tried === false` → not loaded yet (decode on first request);
 *  - `tried === true && app !== undefined` → loaded successfully (reuse);
 *  - `tried === true && app === undefined` → tried and failed (fail closed,
 *    never re-decode — the embedded artifact is version-locked, so a failure
 *    is permanent for the process lifetime).
 */
interface DashboardAppCache {
  readonly tried: boolean
  readonly app?: App
}

// eslint-disable-next-line functional/no-let -- module-level memo, set once on first request
let dashboardAppCache: DashboardAppCache = { tried: false }

/** Minimal structural view of a component node, for the recovery-link prune. */
interface PrunableNode {
  readonly type?: string
  readonly props?: Readonly<Record<string, unknown>>
  readonly children?: readonly unknown[]
}

const asNode = (value: unknown): PrunableNode | undefined =>
  typeof value === 'object' && value !== null ? (value as PrunableNode) : undefined

/** The sign-in card's recovery entry point: `<link href="/_admin/forgot-password">`. */
const isRecoveryLink = (value: unknown): boolean => {
  const node = asNode(value)
  return node?.type === 'link' && node.props?.['href'] === ADMIN_FORGOT_PASSWORD_PATH
}

/** Drop every recovery link in a component subtree, at any depth. */
const pruneRecoveryLinks = (value: unknown): unknown => {
  const node = asNode(value)
  if (node === undefined || !Array.isArray(node.children)) return value
  return {
    ...node,
    children: node.children.filter((child) => !isRecoveryLink(child)).map(pruneRecoveryLinks),
  }
}

/**
 * Remove the sign-in card's recovery link when outgoing mail is unconfigured.
 *
 * A link that opens a form that can never mail anything costs the operator a
 * round trip and their confidence in the console — a dead link is worse than no
 * link. Applied POST-DECODE, alongside the `badge: false` stamp, for the same
 * reason: it is a platform-stamped value, not something authored in the embedded
 * YAML, so no embedded-assets regeneration is involved.
 *
 * Safe to bake into the memoized app: `SMTP_HOST` is fixed for the lifetime of
 * the server process (each E2E `startServerWithSchema` spawns a fresh CLI
 * process with its own env), so a pruned app can never leak into a
 * mail-configured process or vice versa.
 */
const pruneRecoveryEntryPoints = (app: App): App => {
  if (isEmailConfigured() || app.pages === undefined) return app
  const pages = app.pages.map((page) =>
    page.components === undefined
      ? page
      : {
          ...page,
          components: page.components
            .filter((component) => !isRecoveryLink(component))
            .map(pruneRecoveryLinks),
        }
  )
  return { ...app, pages } as App
}

/**
 * Resolve (and memoize) the embedded dashboard `App` config.
 *
 * Reads the embedded YAML via `readEmbeddedDashboardConfig` (which uses
 * `Bun.file()` — works in dev and in the compiled binary's `$bunfs`), then
 * decodes it against `AppSchema`. Returns `undefined` if the artifact is
 * missing or fails to decode, so the mount fails closed.
 *
 * Exported because the console is a SECOND app this server serves, and the CSS
 * route needs it too: a request for the console's stylesheet hash must compile
 * from THIS config, not from the operator's — whose theme would otherwise
 * repaint Sovrium's own chrome. The memo makes that second consumer free.
 */
export const resolveDashboardApp = async (): Promise<App | undefined> => {
  if (dashboardAppCache.tried) {
    return dashboardAppCache.app
  }
  try {
    const yaml = await readEmbeddedDashboardConfig()
    if (yaml === undefined) {
      // eslint-disable-next-line functional/no-expression-statements -- module-level memo write
      dashboardAppCache = { tried: true }
      return undefined
    }
    // AppSchema is statically imported (the module already loads it via the
    // `isAdminTier` import from the same barrel), so a lazy import
    // would defer nothing — decode directly.
    const decoded = Schema.decodeUnknownSync(AppSchema)(Bun.YAML.parse(yaml)) as App
    // The "Built with Sovrium" badge is hard-coded OFF on every /_admin path,
    // including pages rendered from the static dashboard config as-is (e.g.
    // `/login`, which never flows through `buildDashboardSurfaceApp`). Stamped
    // here — post-decode, not in the embedded YAML — so no embedded-assets regen.
    const app: App = pruneRecoveryEntryPoints({ ...decoded, badge: false })
    // eslint-disable-next-line functional/no-expression-statements -- module-level memo write
    dashboardAppCache = { tried: true, app }
    return app
  } catch (error) {
    logError('[ADMIN-DASHBOARD] Failed to load the embedded dashboard config', error)
    // eslint-disable-next-line functional/no-expression-statements -- module-level memo write
    dashboardAppCache = { tried: true }
    return undefined
  }
}

/**
 * Map a `/_admin`-prefixed request path to the path within the embedded
 * dashboard config. `/_admin` and `/_admin/` → `/` (the dashboard home page);
 * `/_admin/tables/contacts` → `/tables/contacts`.
 */
const toDashboardPath = (requestPath: string): string => {
  const stripped = requestPath.slice(ADMIN_PREFIX.length)
  if (stripped === '' || stripped === '/') return '/'
  return stripped
}

/**
 * The two independent postures a `/_admin` caller carries.
 *
 * `hasAccess` is REACHABILITY (`isAdminTier`) — may this caller open the
 * console at all. `canAdministerAccounts` is CAPABILITY
 * (`isAdminEquivalent`) — will the admin plane actually honour the account
 * writes the console can paint. They are orthogonal by design: a read-only
 * operational data console admits roles that hold no write power,
 * and the whole point of carrying the second flag is that a surface must not
 * render an affordance the first flag alone would have justified.
 */
interface CallerPosture {
  readonly hasAccess: boolean
  readonly canAdministerAccounts: boolean
}

/**
 * Resolve whether the caller may reach the `/_admin` mount.
 *
 * Uses the OPERATOR's `App` (`config.app`) to resolve custom-role access so a
 * custom top role (e.g. partner's `engineer`) reaches the dashboard implicitly.
 * Returns `false` for any role resolving to no dashboard access — and for any
 * anonymous caller — which the handler treats as denied (404). Config is
 * code-only, so reachability is binary: any admin gets full access.
 */
const resolveCallerHasAccess = async (
  config: HonoAppConfig,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Promise<CallerPosture> => {
  const session = config.getSession ? await config.getSession(c.req.raw.headers) : undefined
  if (!session) return { hasAccess: false, canAdministerAccounts: false }
  return {
    hasAccess: isAdminTier(session.role, config.app),
    // The ACCOUNT-administration posture, resolved from the same predicate the
    // admin plane's own guards apply (`isAdminEquivalent`). It is deliberately
    // NOT `isAdminTier`: an `admin-viewer` reaches the console (read) and is
    // 404ed by `applyAdminRoleCheckMiddleware` on every `/api/auth/admin/*`
    // write, so painting them "Change role" / "Ban" renders a control their own
    // backend refuses. Consulted by the Users surface to omit those actions.
    canAdministerAccounts: isAdminEquivalent(session.role, config.app),
  }
}

/**
 * Build the `/_admin` request handler. Returns the rendered dashboard HTML
 * (200) for authorized callers; the canonical anti-enumeration 404 for
 * anonymous / non-admin callers (S1) — indistinguishable from "no such route".
 */
/**
 * Resolve the access decision for a `/_admin` request: either a terminal
 * `Response` (404 deny / login redirect) or the granted `{ canEdit }` posture.
 *
 * S1 anti-enumeration: anonymous / non-admin → 404 (never 401/403) on every
 * route outside the exact-match {@link ADMIN_PUBLIC_PATHS} carve-out. An
 * already-authorized admin is redirected to `/_admin` from the paths in
 * {@link ADMIN_SIGNED_IN_REDIRECT_PATHS} (LOGIN-004) — which excludes
 * `/_admin/reset-password`, so a signed-in operator can still spend their token.
 */
const resolveAccess = async (
  config: HonoAppConfig,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context
): Promise<Response | { readonly canEdit: boolean; readonly canAdministerAccounts: boolean }> => {
  const { hasAccess, canAdministerAccounts } = await resolveCallerHasAccess(config, c)
  const { path } = c.req
  if (hasAccess && ADMIN_SIGNED_IN_REDIRECT_PATHS.has(path)) {
    return c.redirect(ADMIN_PREFIX, 302)
  }
  if (!hasAccess && !isPublicAdminPath(path)) {
    return c.html(await config.renderNotFoundPage(config.app), 404)
  }
  // Single admin guard: every admin who reaches the dashboard gets full data
  // access (record editing). There is no config-editing surface, so `canEdit`
  // is uniform for all admins.
  //
  // INVARIANT — an ANONYMOUS caller also reaches this line, on the public
  // carve-out, and is granted `canEdit: true`. That is not an access decision:
  // it is read only by `buildDashboardSurfaceApp`, and no public path resolves
  // to a surface there. `parseDataRoute` tests the first segment against a
  // fixed set of data page keys, and the operator surfaces are a fixed map
  // (`/api`, `/mcp`, `/gdpr`). None of the three public paths
  // belongs to either, so each one falls through to its static embedded page.
  //
  // Should either set ever gain a key equal to a public path, that page stops
  // being static and an anonymous caller is handed a live operator data surface
  // with write access. Those two sets and {@link ADMIN_PUBLIC_PATHS} must stay
  // free of any shared key. Widening the carve-out widens this too — it covered
  // one path before the recovery pair was added.
  //
  // `canAdministerAccounts`, unlike `canEdit`, is a REAL per-caller value and is
  // false for that anonymous carve-out caller — so if a public path ever did
  // resolve to a live surface, it would at least not be painted account-write
  // controls.
  return { canEdit: true, canAdministerAccounts }
}

/**
 * Answer a rendered surface: the SPA partial, the framed preview, or the page.
 *
 * SPA content-only partial: a partial request
 * (header `X-Sovrium-Partial: content` or `?_partial=1`) returns ONLY the inner
 * HTML of `#admin-surface-content` — the shell (`<html>`/sidebar/palette) is
 * stripped so the client nav module swaps just that region. The partial reuses
 * the full render verbatim; if the content marker is missing it falls back to
 * the full document (never an empty partial).
 *
 * A design-system preview exists to be EMBEDDED by the console page. The
 * platform default (`frame-ancestors 'none'` + `X-Frame-Options: DENY`) would
 * have the browser refuse the frame while the server happily answered 200 — a
 * failure that shows up as empty panels and no error anywhere. Narrowed to
 * `'self'`, on routes already behind `requireAdminTier`; see `securityHeaders`
 * for why this is where the decision belongs.
 */
const respondWithSurface = (
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context,
  dashboardPath: string,
  rendered: string
): Response => {
  if (isPartialRequest(c)) {
    const content = extractSurfaceContent(rendered)
    if (content !== undefined) return c.html(content, 200)
  }
  // Both preview shapes: the v1 sections AND the per-category component
  // catalog. The catalog is reached by LINK rather than by frame, but it lives
  // in the same namespace and a reader may well open it beside the console, so
  // it takes the same narrowing rather than inheriting the platform default by
  // accident.
  if (
    parseDesignSystemPreviewRoute(dashboardPath) !== undefined ||
    parseDesignSystemCatalogRoute(dashboardPath) !== undefined
  ) {
    return c.html(rendered, 200, {
      'Content-Security-Policy': "frame-ancestors 'self'",
      'X-Frame-Options': 'SAMEORIGIN',
    })
  }
  return c.html(rendered, 200)
}

/**
 * Render the dashboard surface for an authorized request: synthesize the
 * per-path surface app and render it through the page pipeline.
 */
const renderDashboardSurface = async (
  config: HonoAppConfig,
  // eslint-disable-next-line functional/prefer-immutable-types
  c: Context,
  dashboardApp: App,
  posture: { readonly canEdit: boolean; readonly canAdministerAccounts: boolean }
): Promise<Response> => {
  const dashboardPath = toDashboardPath(c.req.path)
  // The Developers docs surfaces (`/_admin/api`, `/_admin/mcp`) print addresses an
  // operator copies into a terminal or an AI client, so they need the instance's
  // real origin — which only this layer knows, from the live request.
  const surface = await buildDashboardSurfaceApp(dashboardApp, config.app, dashboardPath, {
    ...posture,
    origin: resolveRequestBaseUrl(c),
    // `?scheme=dark` on a design-system preview. Read from the REQUEST and
    // never stored: a scheme the operator asked to look at must not become a
    // preference their whole console then inherits.
    scheme: c.req.query('scheme'),
    // `?period=24h|7d|30d` on an analytics-shaped surface. Read from the
    // REQUEST for the same reason `scheme` is: the window is URL-derived, so
    // back/forward move between periods with no client state and a shared link
    // carries the window it was read at. `toDashboardPath` drops the query
    // string, so path matching is untouched by it
    // ([internal ref]..018).
    period: c.req.query('period'),
  })
  // A bare object-page path (`/_admin/tables`, ≥1 object) resolves to a 302 to its
  // first object (`/_admin/tables/{first}`) — Pass 1 item 1.5a. Emit the redirect
  // before rendering any page (the same `{ redirect }` channel as a page result).
  if (surface !== undefined && isDataObjectRedirect(surface)) {
    return c.redirect(surface.redirect, 302)
  }
  const surfaceApp = surface ?? dashboardApp
  const result: PageRenderResult = await config.renderPage(surfaceApp, dashboardPath)
  if (typeof result === 'string') {
    return respondWithSurface(c, dashboardPath, result)
  }
  if (result && typeof result === 'object' && 'redirect' in result) {
    return c.redirect(result.redirect, 302)
  }
  // No page matched the requested `/_admin/...` sub-path (a Tier-1 surface not
  // yet built) — render the dashboard not-found within the dashboard config.
  return c.html(await config.renderNotFoundPage(dashboardApp), 404)
}

const handleAdminDashboard =
  (config: HonoAppConfig) =>
  // eslint-disable-next-line functional/prefer-immutable-types
  async (c: Context): Promise<Response> => {
    const access = await resolveAccess(config, c)
    if (access instanceof Response) return access

    const dashboardApp = await resolveDashboardApp()
    if (dashboardApp === undefined) {
      return c.html(await config.renderNotFoundPage(config.app), 404)
    }

    try {
      return await renderDashboardSurface(config, c, dashboardApp, access)
    } catch (error) {
      logError(`[ADMIN-DASHBOARD] ${c.req.method} ${c.req.path} → 500`, error)
      return c.html(await config.renderErrorPage(dashboardApp), 500)
    }
  }

/**
 * Auto-mount the embedded dashboard config at `/_admin`.
 *
 * Registered BEFORE the page catch-all (`*`) so the dashboard route wins over
 * the operator's own page resolution — the mount is independent of, and never
 * shadowed by, the operator's config. The {@link ADMIN_PUBLIC_PATHS} carve-out
 * is served by the same handler, exempt from the 404-anonymous gate.
 *
 * @param honoApp - the Hono instance to chain the mount onto
 * @param config - the page/render config (supplies `renderPage`, `getSession`,
 *   `renderNotFoundPage`, and the operator `app` for tier resolution)
 */
export function setupAdminDashboardRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const handler = handleAdminDashboard(config)
  return honoApp.get(ADMIN_PREFIX, handler).get(`${ADMIN_PREFIX}/*`, handler)
}
