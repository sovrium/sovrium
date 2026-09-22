/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Serving the embedded operator console at the path it is mounted at.
 *
 * The console is DOGFOODED: a platform-owned app, authored as `apps/admin/`,
 * frozen into the binary at build time and mounted into every booted app. It
 * renders through the EXISTING page/component pipeline (`config.renderPage`)
 * like any config-driven page, but with the embedded preset `App` — never the
 * operator's.
 *
 * The operator decides WHETHER, never WHAT and never WHERE (founder decision
 * D1): `admin: false` and `SOVRIUM_ADMIN=off` each take the console away, and
 * otherwise it is served at the fixed `/_admin`. Its CONTENTS are not the
 * operator's at all — the config never contains the console, which is the whole
 * of D4.
 *
 * This module still speaks in terms of a `${base}` rather than of `/_admin`,
 * because it is handed the mount rather than reading the config: keeping the
 * base a parameter is what makes every rule below one rule instead of a literal
 * repeated eleven times.
 *
 * ─── AUTHORIZATION ─────────────────────────────────────────────────────────
 *
 * Every mounted route is gated by a single admin guard; anonymous / non-admin
 * callers get a **404**, never 401/403 (S1 anti-enumeration) — indistinguishable
 * from "no such route". The public carve-out is an EXACT-MATCH set of three
 * paths — `${base}/login` plus the two password-recovery surfaces — each
 * reachable without a session so an operator who cannot sign in still has a way
 * back into their own console.
 *
 * Exact match, never a prefix: a `startsWith(`${base}/`)` carve-out would
 * expose the whole console, and would let `${base}/reset-password/../{surface}`
 * shaped paths slip past the guard.
 *
 * An already-authorized admin is redirected to the mount root from
 * `${base}/login` and `${base}/forgot-password` (nothing there for them).
 * `${base}/reset-password` is deliberately EXEMPT: bouncing a signed-in admin
 * off it would discard the emailed `?token=` and strand the reset half-finished.
 *
 * The two recovery paths are additionally gated on outgoing mail being
 * configured — with no SMTP they are omitted from the public set and 404 like
 * any other unreachable path, and the recovery link is pruned from the sign-in
 * card. "Is SMTP configured" is a deployment fact identical for every caller, so
 * gating on it leaks nothing about any user and S1 is untouched.
 *
 * ─── WHY THE MOUNT NEVER REACHES THE SITEMAP OR OPENAPI ────────────────────
 *
 * Not by an exclusion list here, but by construction upstream: the sitemap walks
 * `app.pages[]` and a mount is not a page, and the OpenAPI document is built
 * from literal route specs plus the operator's own resource names. Neither
 * generator can see a Hono route. So the guarantee does not rest on `/_admin`
 * being underscore-prefixed — that prefix is a second, independent reason
 * (`isPageInSitemap`'s `/_` rule), and either one alone would hold.
 */

import { getCookie } from 'hono/cookie'
import {
  buildComponentFrameApp,
  componentFramePath,
} from '@/application/use-cases/admin/design-system-component-frame'
import { isAdminEquivalent, isAdminTier } from '@/domain/models/app'
import { COMPONENT_FRAME_BASE, toMountPath } from '@/domain/models/app/admin/mount-hrefs'
import {
  LANGUAGE_PREFERENCE_COOKIE,
  resolvePreferredLanguage,
} from '@/domain/models/app/languages/language-detection'
import { logError } from '@/infrastructure/logging/logger'
import { isEmailConfigured } from '@/infrastructure/process/env'
import { resolveRequestBaseUrl } from '../../../domain/kernel/url/request-base-url'
import {
  systemRecordFetcher,
  systemRowsFetcher,
} from '../../../infrastructure/egress/system-rows-fetcher'
import {
  PARTIAL_TITLE_HEADER,
  extractDocumentTitle,
  extractSurfaceContent,
  isPartialRequest,
} from './dashboard-partial'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type {
  MountSurfaceInput,
  MountSurfaceOutcome,
} from '@/application/use-cases/mount/embedded-app-mount'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'
import type { Context, Hono } from 'hono'

/**
 * The mount plumbing this route layer needs, injected rather than imported.
 *
 * Keeps the route free of the embedded-asset read and the per-mount synthesis,
 * both of which are testable without a server.
 */
export interface MountedAppRoutesDeps {
  readonly mounts: readonly EmbeddedAppMount[]
  readonly resolveScopedMountApp: (mount: EmbeddedAppMount, operatorApp: App) => App
  readonly synthesiseMountSurface: (input: MountSurfaceInput) => Promise<MountSurfaceOutcome>
}

/**
 * Whether a path is reachable without a session, for THIS mount.
 *
 * The sign-in card is public unconditionally — losing outgoing mail must never
 * cost the operator their way in. The recovery pair is public only while SMTP
 * is configured: a recovery form that can never mail anything is worse than no
 * form at all, so without mail it is absent rather than broken.
 */
const isPublicMountPath = (mount: EmbeddedAppMount, path: string): boolean => {
  if (!mount.publicPaths.has(path)) return false
  return !mount.mailGatedPublicPaths.has(path) || isEmailConfigured()
}

/**
 * The two independent postures a console caller carries.
 *
 * `hasAccess` is REACHABILITY (`isAdminTier`) — may this caller open the
 * console at all. `canAdministerAccounts` is CAPABILITY (`isAdminEquivalent`) —
 * will the admin plane actually honour the account writes the console can
 * paint. They are orthogonal by design: a read-only operational data console
 * admits roles that hold no write power, and the whole point of
 * carrying the second flag is that a surface must not render an affordance the
 * first flag alone would have justified.
 */
interface CallerPosture {
  readonly hasAccess: boolean
  readonly canAdministerAccounts: boolean
  /**
   * The resolved session itself, carried forward for ONE purpose: projecting the
   * operator table a mounted Records page binds down to the fields this caller
   * may read. Two booleans cannot express that — field permissions are resolved
   * against roles and groups, not against a console tier.
   */
  readonly session?: SessionInfo
}

/**
 * Resolve whether the caller may reach a mount.
 *
 * Uses the OPERATOR's `App` (`config.app`) to resolve custom-role access, so a
 * custom top role (e.g. partner's `engineer`) reaches the console implicitly.
 * Returns `false` for any role resolving to no access — and for any anonymous
 * caller — which the handler treats as denied (404). Config is code-only, so
 * reachability is binary: any admin gets full access.
 */
const resolveCallerPosture = async (
  config: HonoAppConfig,

  c: Context
): Promise<CallerPosture> => {
  const session = config.getSession ? await config.getSession(c.req.raw.headers) : undefined
  if (!session) return { hasAccess: false, canAdministerAccounts: false }
  return {
    session,
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

/** The granted posture a rendered surface is built with. */
interface GrantedAccess {
  readonly canEdit: boolean
  readonly canAdministerAccounts: boolean
  /** The caller's session — see {@link CallerPosture.session}. */
  readonly session?: SessionInfo
}

/**
 * Resolve the access decision: either a terminal `Response` (404 deny / signed-in
 * redirect) or the granted posture.
 *
 * S1 anti-enumeration: anonymous / non-admin → 404 (never 401/403) on every
 * route outside this mount's exact-match public carve-out.
 */
const resolveAccess = async (
  mount: EmbeddedAppMount,
  config: HonoAppConfig,

  c: Context
): Promise<Response | GrantedAccess> => {
  const { hasAccess, canAdministerAccounts, session } = await resolveCallerPosture(config, c)
  const { path } = c.req
  if (hasAccess && mount.signedInRedirectPaths.has(path)) {
    return c.redirect(mount.basePath, 302)
  }
  if (!hasAccess && !isPublicMountPath(mount, path)) {
    return c.html(await config.renderNotFoundPage(config.app), 404)
  }
  // Single admin guard: every admin who reaches the console gets full data
  // access (record editing). There is no config-editing surface, so `canEdit`
  // is uniform for all admins.
  //
  // INVARIANT — an ANONYMOUS caller also reaches this line, on the public
  // carve-out, and is granted `canEdit: true`. That is not an access decision:
  // it is read only by the surface builder, and no public path resolves to a
  // surface there. The builder now claims exactly three paths (`/api`, `/mcp`,
  // `/schema`) plus the design-system family; every operator-data destination
  // is an authored preset page. None of the three public paths belongs to
  // either set, so each falls through to its static preset page.
  //
  // Should either set ever gain a key equal to a public path, that page stops
  // being static and an anonymous caller is handed a live operator data surface
  // with write access. Those two sets and the mount's public set must stay free
  // of any shared key.
  //
  // `canAdministerAccounts`, unlike `canEdit`, is a REAL per-caller value and is
  // false for that anonymous carve-out caller — so if a public path ever did
  // resolve to a live surface, it would at least not be painted account-write
  // controls.
  return { canEdit: true, canAdministerAccounts, ...(session ? { session } : {}) }
}

/**
 * Answer a rendered surface: the SPA partial, or the page.
 *
 * SPA content-only partial: a partial request
 * (header `X-Sovrium-Partial: content` or `?_partial=1`) returns ONLY the inner
 * HTML of `#admin-surface-content` — the shell is stripped so the client nav
 * module swaps just that region. The partial reuses the full render verbatim;
 * if the content marker is missing it falls back to the full document (never an
 * empty partial).
 */
const respondWithSurface = (c: Context, rendered: string): Response => {
  if (isPartialRequest(c)) {
    const content = extractSurfaceContent(rendered)
    if (content !== undefined) {
      // The destination's title travels BESIDE the body, because it lives in
      // the `<head>` the partial strips. Without it the tab, the bookmark and
      // the screen reader's page-change announcement all keep naming whatever
      // surface the operator started on.
      const title = extractDocumentTitle(rendered)
      return c.html(content, 200, title === undefined ? {} : { [PARTIAL_TITLE_HEADER]: title })
    }
  }
  return c.html(rendered, 200)
}

/** Everything rendering one mounted request needs. */
interface MountedRenderInput {
  readonly mount: EmbeddedAppMount
  readonly deps: MountedAppRoutesDeps
  readonly config: HonoAppConfig
  readonly c: Context
  readonly scopedApp: App
  readonly posture: GrantedAccess
}

/**
 * The caller's powers, as the closed {@link CallerCapability} vocabulary spells
 * them — the ONE thing a mounted page's capability gates need and cannot derive.
 *
 * `resolveCallerPosture` has already computed both, because it needs them to
 * decide whether to serve the request at all; this is the same two booleans in
 * the shape `visibility.capability` and an action column's `capability` read.
 *
 * A mounted page renders session-less (see `holdsCapability`,
 * `presentation/rendering/visibility-filter.ts`), so passing the POWERS is
 * deliberately narrower than passing the session: a capability set cannot be
 * read as a role, cannot resolve `$user.*`, and cannot reach a row filter.
 *
 * `hasAccess` is not carried on `GrantedAccess`, and does not need to be: this
 * function is only ever reached past the `!hasAccess` deny in `resolveAccess`,
 * so a caller who is here holds `admin-console` by construction — EXCEPT on the
 * anonymous public carve-out, which holds neither and is given neither
 * (`canAdministerAccounts` is a real per-caller value and is false there).
 */
const grantedCapabilitiesOf = (posture: GrantedAccess): readonly CallerCapability[] =>
  posture.session === undefined
    ? []
    : posture.canAdministerAccounts
      ? ['admin-console', 'administer-accounts']
      : ['admin-console']

/** Render the console surface for an authorized request into a mount. */
const renderMountedSurface = async (input: MountedRenderInput): Promise<Response> => {
  const { mount, deps, config, c, scopedApp, posture } = input
  const mountPath = toMountPath(mount.basePath, c.req.path)
  const surface = await deps.synthesiseMountSurface({
    mount,
    operatorApp: config.app,
    scopedApp,
    mountPath,
    ...(posture.session ? { session: posture.session } : {}),
  })
  // ─── NO `?scheme` / `?viewport` / `?expand` / `?category` CHANNEL ─────────
  //
  // Four URL parameters used to be lifted out of the request here and threaded
  // into a builder, because a synthesised surface had no other way to see them.
  // Every console destination is an authored page now and declares its own
  // `page.query`, so each of the four arrives through the ordinary interpreter
  // path — clamped to a declared `enum` on the way in, which the side channel
  // never was. A second route for the same parameter is a way for the two to
  // disagree about what the URL said.
  // `none` means the path has no synthesized surface (a static preset page such
  // as the sign-in card) — render the mount's own config as authored.
  const surfaceApp = surface.kind === 'app' ? surface.app : scopedApp
  // The operator's persisted language, resolved against the MOUNTED app's own
  // `languages.supported` — ACCOUNT first, then this browser's cookie, the same
  // rank the ordinary page routes apply (`preferredLanguageFor`,
  // `presentation/api/pages/page-routes.ts`). A preference saved on an account
  // travels to every machine its owner signs in on; the cookie is what one
  // browser remembers.
  //
  // Derived from `posture.session` LOCALLY rather than threaded into
  // `renderPage`: a mounted page renders session-less by design, and what the
  // renderer needs is the resolved language, not the identity it came from.
  const preferredLanguage =
    resolvePreferredLanguage(surfaceApp.languages, posture.session?.language) ??
    resolvePreferredLanguage(surfaceApp.languages, getCookie(c, LANGUAGE_PREFERENCE_COOKIE))
  const result: PageRenderResult = await config.renderPage(surfaceApp, mountPath, {
    requestQuery: c.req.query(),
    requestOrigin: resolveRequestBaseUrl(c),
    // The operator's persisted language, resolved against the MOUNTED app's own
    // `languages.supported` — never the operator's. A mount is a second app on
    // the operator's origin and one browser carries one preference, so the
    // clamp is what keeps a console that declares `en`/`fr` from being served
    // `lang="es-ES"` over English strings.
    //
    // Threaded as `urlLanguage` because that is the rank it needs, not because
    // a URL said anything: every preset page pins `meta.lang`, and a preference
    // entering BELOW that pin would be inert on the one surface it was added
    // for — inert, and silently. `undefined` leaves the pin deciding, which is
    // the right answer for an operator who has chosen nothing
    //.
    ...(preferredLanguage ? { urlLanguage: preferredLanguage } : {}),
    // G1: a mounted console prints the OPERATOR's name and version, never the
    // preset's own — which is the fact its config cannot reach.
    hostApp: config.app,
    // G2: the crumbs derive from the STRIPPED path, so their hrefs hang off the
    // mount rather than off the operator's own root.
    basePath: mount.basePath,
    // G3: the server-side rows reader, WITHOUT which `page.redirectToFirst` is
    // inert on a mount — and inert SILENTLY. `resolveFirstObjectRedirect`
    // degrades an absent fetcher to "no first row", which is the same answer as
    // an empty collection, so a console page that should 302 to its first
    // object just rendered its own empty state instead.
    //
    // A mounted app does not pass through `renderWithCache`, which is where the
    // operator page funnel builds this. Both funnels now call the ONE
    // constructor rather than each carrying the borrowed-identity header list.
    fetchSystemRows: systemRowsFetcher(c),
    // [internal ref]: the SINGLE-RECORD sibling. A page bound to a `{ system }`
    // detail endpoint is NAMED by its record, so it must be read before the
    // document ships — as the caller, and 404ing when there is none.
    fetchSystemRecord: systemRecordFetcher(c),
    // P10: the caller's POWERS — not their session. Without this the two
    // capability gates are inert on every mounted page, and inert in the
    // direction that withholds an affordance from the administrator it was
    // authored for. See `grantedCapabilitiesOf`.
    callerCapabilities: grantedCapabilitiesOf(posture),
  })
  if (typeof result === 'string') {
    return respondWithSurface(c, result)
  }
  if (result && typeof result === 'object' && 'redirect' in result) {
    return c.redirect(result.redirect, 302)
  }
  // No page matched the requested sub-path — render the console's own
  // not-found within the console config.
  return c.html(await config.renderNotFoundPage(scopedApp), 404)
}

/**
 * The framing decision this one route makes, in both vocabularies.
 *
 * The platform default is `frame-ancestors 'none'` + `X-Frame-Options: DENY`
 * (`infrastructure/server/middleware/security-headers.ts`), which would block a
 * viewport frame OUTRIGHT — the document would be fetched and then refused by
 * the browser, with nothing in the console page to say why. This route is the
 * first consumer of that middleware's per-route override.
 *
 * `'self'` and not a blanket relaxation: the console is the only page entitled
 * to frame a specimen, and `'self'` still refuses every origin an attacker
 * could control without already controlling this app. Both headers are set
 * because they express ONE decision in two vocabularies — a browser honouring
 * only the legacy header would otherwise refuse what the modern one allows.
 *
 * The other three structural directives are RESTATED rather than dropped.
 * Overriding `Content-Security-Policy` replaces the header wholesale, so a
 * policy carrying `frame-ancestors` alone would silently give this document
 * back the `object-src`, `base-uri` and `form-action` protections every other
 * response on the server has.
 */
const SAME_ORIGIN_FRAMING: Readonly<Record<string, string>> = {
  'Content-Security-Policy':
    "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  'X-Frame-Options': 'SAMEORIGIN',
}

/**
 * Answer one viewport frame: the operator's own template, re-rendered in a
 * document whose viewport IS the declared width.
 *
 * ─── IT REUSES THE CONSOLE'S ACCESS DECISION, RATHER THAN MAKING ONE ───────
 *
 * `resolveAccess` is the same call the surface handler makes, so the framed
 * document is reachable by exactly the callers who may read the page that
 * frames it, and 404s (never 401/403 — S1 anti-enumeration) for everyone else.
 * A read surface that answered differently from the page framing it would be a
 * read surface nobody audited.
 *
 * ─── AND IT RESOLVES THE TEMPLATE FROM `config.app`, NOT THROUGH THE PAGE
 *     ROUTER ───────────────────────────────────────────────────────────────
 *
 * `isComponentsSurfacePath` — which is what merges the operator's `components[]`
 * into a console surface — admits only 2- or 3-segment
 * `/design-system/components[/:name]` paths. This route's path has four, so
 * routing through the page router would find the operator's components simply
 * ABSENT, with no error. Holding `config.app` directly is both simpler and the
 * reason that predicate does not have to be widened.
 *
 * GET only, by registration: nothing else is chained here, so a POST falls
 * through to the mount's own catch-all and 404s like any unrouted path.
 */
const handleComponentFrame =
  (mount: EmbeddedAppMount, config: HonoAppConfig) =>
  async (c: Context): Promise<Response> => {
    const access = await resolveAccess(mount, config, c)
    if (access instanceof Response) return access

    const name = c.req.param('name') ?? ''
    const path = componentFramePath(name)
    const frameApp = buildComponentFrameApp(config.app, name, path)
    // A name this app does not declare gets the SAME answer the component page
    // itself gives one — `-133`'s property, one document further in.
    if (frameApp === undefined) return c.html(await config.renderNotFoundPage(config.app), 404)

    try {
      const rendered = await config.renderPage(frameApp, path, {
        requestQuery: c.req.query(),
        requestOrigin: resolveRequestBaseUrl(c),
      })
      if (typeof rendered !== 'string') {
        return c.html(await config.renderNotFoundPage(config.app), 404)
      }
      return c.html(rendered, 200, SAME_ORIGIN_FRAMING)
    } catch (error) {
      logError(`[ADMIN-DASHBOARD] ${c.req.method} ${c.req.path} → 500`, error)
      return c.html(await config.renderErrorPage(config.app), 500)
    }
  }

const handleMountedApp =
  (mount: EmbeddedAppMount, deps: MountedAppRoutesDeps, config: HonoAppConfig) =>
  async (c: Context): Promise<Response> => {
    const access = await resolveAccess(mount, config, c)
    if (access instanceof Response) return access

    // The SCOPED console config, so every page of this mount links one
    // stylesheet identity and that stylesheet carries the operator's own design
    // system as a subtree layer.
    const scopedApp = deps.resolveScopedMountApp(mount, config.app)

    try {
      return await renderMountedSurface({
        mount,
        deps,
        config,
        c,
        scopedApp,
        posture: access,
      })
    } catch (error) {
      logError(`[ADMIN-DASHBOARD] ${c.req.method} ${c.req.path} → 500`, error)
      return c.html(await config.renderErrorPage(scopedApp), 500)
    }
  }

/**
 * Register every embedded-app mount.
 *
 * Registered BEFORE the language routes and the page catch-all (`*`) so a mount
 * wins over the operator's own page resolution — the console is independent of,
 * and never shadowed by, the operator's config. It is also why a `/{lang}/*`
 * route cannot swallow a mount: the mounts are already matched.
 *
 * With zero mounts (`admin: false`, or `SOVRIUM_ADMIN=off`) this registers
 * nothing at all, so every would-be console path falls through to the ordinary
 * page catch-all and 404s like any unrouted path — for admins exactly as for
 * anonymous callers.
 *
 * @param honoApp - the Hono instance to chain the mounts onto.
 * @param config - the page/render config.
 * @param deps - the mount list and the synthesis functions.
 */
export function setupMountedAppRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig,
  deps: MountedAppRoutesDeps
): Readonly<Hono> {
  return deps.mounts.reduce<Readonly<Hono>>((chained, mount) => {
    const handler = handleMountedApp(mount, deps, config)
    return (
      chained
        // BEFORE the catch-all, deliberately. The mount owns its whole subtree,
        // so `${base}/*` would otherwise swallow this path into the page router
        // — which resolves against declared page paths and has no page here.
        .get(`${mount.basePath}${COMPONENT_FRAME_BASE}/:name`, handleComponentFrame(mount, config))
        .get(mount.basePath, handler)
        .get(`${mount.basePath}/*`, handler)
    )
  }, honoApp)
}
