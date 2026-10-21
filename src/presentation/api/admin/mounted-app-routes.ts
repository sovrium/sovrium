/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Serving the embedded operator console at the path it is mounted at.
 *
 * The console is DOGFOODED: a platform-owned app, authored as `src/admin/`,
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

import {
  buildComponentFrame,
  componentFramePath,
} from '@/application/use-cases/admin/design-system-component-frame'
import { COMPONENT_FRAME_BASE, toMountPath } from '@/domain/models/app/admin/mount-hrefs'
import { consoleAdmits } from '@/domain/models/app/auth/passkeys-service'
import {
  extractSurfaceContent,
  isPartialRequest,
  partialEchoHeaders,
} from '@/presentation/api/runtime/content-partial'
import { throwIfPageFaultInjected } from '@/presentation/api/runtime/page-fault-injection'
import { answerRenderFailure } from '@/presentation/api/runtime/render-failure-answer'
import { resolveRequestBaseUrl } from '../../../domain/kernel/url/request-base-url'
import { isPublicMountPath } from './mounted-app-public-paths'
import { resolveMountedRedirect, signedInDestination } from './mounted-app-redirect'
import { signedOutConsoleNotFound } from './mounted-not-found'
import {
  INTERNAL_ERROR_PATH,
  mountedPreferredLanguage,
  mountedRenderOptions,
  renderMountedErrorPage,
} from './mounted-render-options'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { PageRenderResult } from '@/application/ports/services/page-renderer'
import type {
  MountSurfaceInput,
  MountSurfaceOutcome,
} from '@/application/use-cases/mount/embedded-app-mount'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
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
 * A console caller's posture. `hasAccess` is REACHABILITY (`isAdminTier`, plus
 * a passkey under `requireForAdmin`) — may this caller open the console at all.
 * What the caller may WRITE is not a flag here: it is the capability set
 * `mountedRenderOptions` derives from the session, because a read-only
 * operational data console admits roles that hold no write power, and
 * a surface must not render an affordance reachability alone would justify.
 */
interface CallerPosture {
  readonly hasAccess: boolean
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
  if (!session) return { hasAccess: false }
  // `consoleAdmits` requires a passkey too, under `requireForAdmin`.
  return { session, hasAccess: consoleAdmits(session, config.app) }
}

/** The granted posture a rendered surface is built with. */
interface GrantedAccess {
  readonly canEdit: boolean
  /** Whether the console admits this caller — false for a member on the public carve-out. */
  readonly hasAccess: boolean
  /** The caller's session — see {@link CallerPosture.session}. */
  readonly session?: SessionInfo
}

/**
 * Resolve the access decision: either a terminal `Response` (404 deny / signed-in
 * redirect) or the granted posture.
 *
 * S1 anti-enumeration: anonymous / non-admin → 404 (never 401/403) on every
 * route outside this mount's exact-match public carve-out — one document for
 * every such address, carrying the way back to the sign-in page.
 */
const resolveAccess = async (
  mount: EmbeddedAppMount,
  config: HonoAppConfig,

  c: Context
): Promise<Response | GrantedAccess> => {
  const { hasAccess, session } = await resolveCallerPosture(config, c)
  const { path } = c.req
  if (hasAccess && mount.signedInRedirectPaths.has(path)) {
    return c.redirect(signedInDestination(mount, c.req.query('next')), 302)
  }
  if (!hasAccess && !isPublicMountPath(mount, path)) {
    return c.html(await signedOutConsoleNotFound(mount, config, c), 404)
  }
  // Single admin guard: every admin reaching the console gets full data access
  // (no config-editing surface exists, so `canEdit` is uniform for admins).
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
  // The capability set, unlike `canEdit`, is a REAL per-caller value and is
  // empty for that anonymous carve-out caller — so if a public path ever did
  // resolve to a live surface, it would at least not be painted write controls.
  return { canEdit: true, hasAccess, ...(session ? { session } : {}) }
}

/** Kept by the reader's own browser alone, and asked for again before reuse. */
const PER_READER = 'private, no-cache'

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
const respondWithSurface = (c: Context, rendered: string, status: 200 | 404 = 200): Response => {
  // A console page is drawn for its reader — her powers, and her identity for a
  // `$user.*` gate — so no shared cache may keep one and hand it to another.
  c.header('Cache-Control', PER_READER)
  if (isPartialRequest(c)) {
    const content = extractSurfaceContent(rendered)
    if (content !== undefined) {
      // The destination's title travels BESIDE the body, because it lives in
      // the `<head>` the partial strips. Without it the tab, the bookmark and
      // the screen reader's page-change announcement all keep naming whatever
      // surface the operator started on.
      //
      // The echo says the body really IS the region: a fallback to the full
      // document below carries no echo, so the client full-loads rather than
      // nesting a whole page inside the region.
      return c.html(content, status, partialEchoHeaders(rendered))
    }
  }
  return c.html(rendered, status)
}

/** The console page a missing address renders, answered with a 404 even when asked for directly. */
const NOT_FOUND_PATH = '/404'
const statusOf = (mountPath: string): 200 | 404 => (mountPath === NOT_FOUND_PATH ? 404 : 200)

/** Everything rendering one mounted request needs. */
interface MountedRenderInput {
  readonly mount: EmbeddedAppMount
  readonly deps: MountedAppRoutesDeps
  readonly config: HonoAppConfig
  readonly c: Context
  readonly scopedApp: App
  readonly posture: GrantedAccess
}

/** Render the console surface for an authorized request into a mount. */
const renderMountedSurface = async (input: MountedRenderInput): Promise<Response> => {
  const { mount, deps, config, c, scopedApp, posture } = input
  const mountPath = toMountPath(mount.basePath, c.req.path)
  throwIfPageFaultInjected(c.req.path)
  const preferredLanguage = mountedPreferredLanguage(scopedApp, posture.session, c)
  const surface = await deps.synthesiseMountSurface({
    mount,
    operatorApp: config.app,
    scopedApp,
    mountPath,
    ...(posture.session ? { session: posture.session } : {}),
    language: preferredLanguage,
  })
  // No `?scheme` / `?viewport` / `?expand` / `?category` channel here: every
  // console page declares its own `page.query`, so each arrives through the
  // interpreter clamped to a declared `enum` — a second route for the same
  // parameter is a way for the two to disagree about what the URL said.
  // `none` means the path has no synthesized surface (a static preset page such
  // as the sign-in card) — render the mount's own config as authored.
  const surfaceApp = surface.kind === 'app' ? surface.app : scopedApp
  const renderOptions = mountedRenderOptions({
    mount,
    config,
    c,
    session: posture.session,
    preferredLanguage,
  })
  const result: PageRenderResult =
    mountPath === INTERNAL_ERROR_PATH
      ? undefined
      : await config.renderPage(surfaceApp, mountPath, renderOptions)
  if (typeof result === 'string') {
    return respondWithSurface(c, result, statusOf(mountPath))
  }
  if (result && typeof result === 'object' && 'redirect' in result) {
    return c.redirect(result.redirect, 302)
  }
  return renderMissing(input, renderOptions, preferredLanguage)
}

/**
 * No page matched: an operator the console admits gets its own `/404` drawn
 * like any page, shell included; anyone else, or a console declaring none,
 * the bare not-found (S1 — no console chrome for a caller it does not admit).
 */
const renderMissing = async (
  { config, c, scopedApp, posture }: MountedRenderInput,
  options: Parameters<HonoAppConfig['renderPage']>[2],
  language: string | undefined
): Promise<Response> => {
  const page = posture.hasAccess
    ? await config.renderPage(scopedApp, NOT_FOUND_PATH, options)
    : undefined
  if (typeof page === 'string') return respondWithSurface(c, page, 404)
  return c.html(await config.renderNotFoundPage(scopedApp, language), 404)
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
    const frame = buildComponentFrame(config.app, name, path)
    // An undeclared name gets the 404 the component page itself answers.
    if (frame === undefined) return c.html(await config.renderNotFoundPage(config.app), 404)

    try {
      const rendered = await config.renderPage(frame.app, frame.renderPath, {
        requestQuery: { ...c.req.query(), ...frame.requestQuery },
        requestOrigin: resolveRequestBaseUrl(c),
        specimen: true, // sample readers only: nothing of the instance is read
      })
      if (typeof rendered !== 'string') {
        return c.html(await config.renderNotFoundPage(config.app), 404)
      }
      return c.html(rendered, 200, SAME_ORIGIN_FRAMING)
    } catch (error) {
      return answerRenderFailure(c, error, (id) =>
        config.renderErrorPage(config.app, undefined, id)
      )
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

    // Its own `redirects`, only AFTER the access decision (a denied caller gets 404).
    const redirect = resolveMountedRedirect(mount, scopedApp, c)
    if (redirect !== undefined) return redirect

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
      const { session, hasAccess } = access
      const preferredLanguage = mountedPreferredLanguage(scopedApp, session, c)
      const failed = { mount, config, c, scopedApp, session, preferredLanguage, hasAccess }
      return answerRenderFailure(c, error, (id) => renderMountedErrorPage(failed, id))
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
