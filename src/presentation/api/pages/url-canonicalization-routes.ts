/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * URL canonicalization — trailing-slash normalization and the unprefixed-path
 * language fallback.
 *
 * Two handlers, one file, because they share the reserved-prefix set, the
 * locale resolver and the `Vary` contract — and because their composition is
 * the behaviour that matters:
 *
 * ```
 * /docs/   → 301 /docs   → 302 /en/docs   → 200
 * /en/docs/→ 301 /en/docs                 → 200
 * /fr/docs/→ 301 /fr/docs   (keeps the locale it arrived under)
 * /en/     → 200            (exempt — the bare language root is canonical WITH the slash)
 * /nope/   → 404, no Location
 * ```
 *
 * ## Two hops, deliberately not one
 *
 * Hop 1 is **301**: stripping a trailing slash is a pure function of the URL, no
 * request header participates, so permanent-cacheable is the point. Hop 2 is
 * **302 + `Vary: Accept-Language`**: its target comes from
 * `detectLanguageIfEnabled(...) ?? languages.default`, and a 301 would pin the
 * first-seen locale in the browser cache forever. The asymmetry is existing
 * precedent, not novelty — `/en` → `/en/` already 301s (deterministic) while
 * `/` → `/fr/` already 302s (negotiated). Collapsing the hops would fuse a
 * deterministic mapping into a negotiated one and stop composing with
 * `app.redirects`.
 *
 * ## Every redirect is resolve-gated AND access-gated
 *
 * Neither handler ever emits a redirect toward a path that would 404. A 301 or
 * 302 into a 404 burns the redirect, still fails, and walks a crawler into a
 * dead end — strictly worse than the honest 404 it replaced.
 *
 * Nor toward a page an anonymous visitor may not read. Resolving the PATTERN is
 * not enough: a redirect toward a role-gated page, where an undeclared path
 * 404s, discloses that the page exists — a bit the direct request deliberately
 * hides, since the canonical path 404s too (S1, `[internal ref]` /
 * `[internal ref]`). Every redirect therefore gates on
 * `resolvesToPublicDeclaredPage`.
 *
 * The one guard that keeps the ungated `resolvesToDeclaredPage` is the
 * normalizer's pass-through for a path authored WITH its slash: it emits no
 * redirect, so it discloses nothing, and gating it would strip an author's own
 * gated `/docs/` page toward a path they never declared.
 *
 * Both predicates are pure domain functions, NOT the renderer: the renderer
 * runs the shared-view anti-enumeration gate and WRITES to the page cache, so
 * using it as a routing predicate would give a probe side effects.
 *
 * ## Termination is provable
 *
 * The trailing-slash handler fires only on `/.+\/+$` and emits a path that
 * cannot end in `/` — its own precondition is false on its own output. The
 * fallback fires only on a path carrying no valid locale prefix and emits one —
 * same argument. Cross-handoff runs trailing-slash → fallback by design;
 * fallback → trailing-slash is unreachable, because the fallback's target ends
 * in `/` only if its input did, and such an input was already claimed by the
 * trailing-slash handler. Chain length is at most 2.
 *
 * ## Mount point
 *
 * Registered between `setupContentDirIndexRedirectRoutes` and
 * `setupLanguageRoutes`, trailing-slash first. Both boundaries are load-bearing:
 *  - `/_admin` is mounted INSIDE `setupPageRoutes`, so a `get('*')` at the
 *    `server.ts` redirect position would shadow the entire admin console;
 *  - `/:lang/*` is terminal (it 404s rather than calling `next()`), so anything
 *    registered after it is dead code for every two-plus-segment path — and
 *    `/manifesto/` matches it with `lang = 'manifesto'`, so a catch-all mounted
 *    later would never see a single-segment path either.
 *
 * SERVER MODE ONLY, by construction: these are live Hono routes. `sovrium build`
 * emits no redirects at all, so a statically-built site keeps the pre-[internal ref]
 * behaviour.
 */

import { requestSearch } from '@/domain/kernel/url/request-search'
import {
  detectLanguageIfEnabled,
  validateLanguageSubdirectory,
} from '@/domain/models/app/languages/language-detection'
import {
  resolvesToDeclaredPage,
  resolvesToPublicDeclaredPage,
} from '@/domain/models/app/pages/page-path-resolvability'
import { varyOnAcceptLanguage } from '@/presentation/api/runtime/vary'
import type { EmbeddedAppMount } from '../../../application/ports/contracts/embedded-app-mount'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Server-global namespaces that are not page paths and must never be normalized
 * or locale-prefixed. Checked as a PREFIX (with the trailing `/`) so `/apiary`
 * is an ordinary page path while `/api/…` is not.
 *
 * Without this a mistyped asset URL (`/assets/output.css/`) would 301 to the
 * live stylesheet, and the whole `/api/*` surface could be swallowed by a
 * canonicalizing catch-all.
 *
 * The console's own namespace is NOT listed here, even though its base is fixed
 * at `/_admin`. It is derived from the resolved mount instead — see
 * {@link reservedPrefixesFor} — because an app that switched the console off
 * (`admin: false`, or `SOVRIUM_ADMIN=off`) reserves nothing: a literal entry
 * would keep `/_admin/…` exempt from canonicalization on a server where it is
 * an ordinary unrouted path.
 */
const GLOBAL_RESERVED_PREFIXES: readonly string[] = ['/api/', '/assets/', '/.well-known/']

/**
 * Every reserved prefix for THIS app: the server-global ones, plus the console
 * mount's when there is one.
 *
 * A mount owns its whole subtree, so its base is reserved as `${base}/` — the
 * same trailing-slash discipline the global list uses, so `/_administration`
 * stays an ordinary page path beside the mount at `/_admin`. The bare base
 * itself needs no entry: the mount route matches it exactly and is registered
 * first.
 *
 * Takes the resolved mounts rather than reading them, and is evaluated ONCE at
 * route registration rather than per request (W5c). Both changes are the same
 * change: resolving a mount decodes an embedded build artifact, which this file
 * may not reach once it lands in `presentation/api/redirects/`, so the
 * composition root resolves it and threads the answer on
 * `HonoAppConfig.adminMounts`. The list is fixed for the lifetime of the
 * process, so the per-request rebuild it replaces bought nothing.
 */
const reservedPrefixesFor = (mounts: readonly EmbeddedAppMount[]): readonly string[] => [
  ...GLOBAL_RESERVED_PREFIXES,
  ...mounts.map((mount) => `${mount.basePath}/`),
]

const isReservedPath = (reservedPrefixes: readonly string[], path: string): boolean =>
  reservedPrefixes.some((prefix) => path.startsWith(prefix))

/**
 * True when `path` is a BARE language root (`/en/`, `/fr/`) — the one path
 * whose canonical form carries a trailing slash.
 *
 * The `segments.length === 1` conjunct is load-bearing and is the single point
 * of failure of the whole feature. `validateLanguageSubdirectory` also returns
 * `'en'` for `/en/docs/`, so dropping it would exempt EVERY prefixed path and
 * make trailing-slash normalization a no-op for its own motivating case. Keeping
 * it too broad in the other direction is equally fatal: `[internal ref]`
 * ships a 301 from `/en` TO `/en/`, so stripping `/en/` would bounce the browser
 * between the two forever.
 */
const isBareLanguageRoot = (app: App, path: string): boolean =>
  path.split('/').filter(Boolean).length === 1 &&
  validateLanguageSubdirectory(app, path) !== undefined

/**
 * The locale an unprefixed path should be sent to: the browser-detected
 * language when detection is on and matches a configured code, otherwise
 * `languages.default`. `undefined` for an app declaring no languages, where
 * there is no locale to invent.
 *
 * `??` and not `||`: `detectLanguageIfEnabled` returns `string | undefined` and
 * never the empty string, so `||` would only add a falsy case that cannot occur
 * while hiding the intent.
 */
const resolveTargetLanguage = (app: App, header: string | undefined): string | undefined => {
  const { languages } = app
  if (!languages) return undefined
  return detectLanguageIfEnabled(app, header) ?? languages.default
}

/** The `/{language}`-prefixed twin of a root-relative path. */
const withLanguagePrefix = (language: string, path: string): string =>
  path === '/' ? `/${language}/` : `/${language}${path}`

/**
 * Whether `path` is unreachable as authored but WOULD resolve once prefixed
 * with the visitor's resolved locale — i.e. whether the language fallback below
 * would answer it.
 *
 * Suppressed when `path` already carries a valid locale prefix, so an
 * already-prefixed miss (`/en/nope`) is never rescued by inventing
 * `/en/en/nope`.
 *
 * Access-gated, because this answers a REDIRECT question on both of its call
 * paths: `/private/` reaches the trailing-slash 301 through here while
 * `/private` reaches the 302 below, so gating only the direct half would leave
 * the same disclosure reachable one keystroke away.
 */
const resolvesViaLanguageFallback = (
  app: App,
  path: string,
  header: string | undefined
): boolean => {
  if (validateLanguageSubdirectory(app, path) !== undefined) return false
  const language = resolveTargetLanguage(app, header)
  if (language === undefined) return false
  return resolvesToPublicDeclaredPage(app, withLanguagePrefix(language, path))
}

/**
 * Trailing-slash normalization ([internal ref]..030).
 *
 * Guards run cheapest-and-most-exempting first; the great majority of real
 * traffic exits at guard 2 without touching the page list.
 */
function handleTrailingSlash(app: App, reservedPrefixes: readonly string[]) {
  return async (c: Readonly<Context>, next: () => Promise<void>) => {
    const { path } = c.req
    if (path === '/' || !path.endsWith('/')) return next()
    if (isReservedPath(reservedPrefixes, path)) return next()
    if (isBareLanguageRoot(app, path)) return next()
    // The authored config is the authority: `PathSchema` permits `path: '/docs/'`
    // and a trailing `*` segment is already slash-tolerant, so a path that
    // resolves WITH its slash is served, never stripped into a 404.
    if (resolvesToDeclaredPage(app, path)) return next()

    // `/\/+$/` and not `slice(0, -1)`: `/docs//` must collapse in ONE hop, or the
    // emitted `Location` itself still ends in a slash and re-fires this handler.
    const stripped = path.replace(/\/+$/, '')
    // Access-gated, unlike the pass-through guard above: this one decides
    // whether to EMIT a 301, and `/vault/` → 301 `/vault` where `/nope/` → 404
    // announces that `/vault` exists to a visitor its 404 keeps in the dark.
    const direct = resolvesToPublicDeclaredPage(app, stripped)
    // The disjunction is required: on a config whose docs pages exist only as
    // `/en/docs` and `/fr/docs`, the stripped `/docs` resolves to nothing, so a
    // direct-only gate would leave `/docs/` a plain 404 and the motivating bug
    // unfixed.
    const viaLanguage =
      !direct && resolvesViaLanguageFallback(app, stripped, c.req.header('Accept-Language'))
    if (!direct && !viaLanguage) return next()

    // Conditional, and this is the branch that operationally matters: a 301 is
    // heuristically cacheable and browsers keep it near-permanently, so a hop
    // whose eligibility was decided by `Accept-Language` must say so.
    if (viaLanguage) varyOnAcceptLanguage(c)
    return c.redirect(`${stripped}${requestSearch(c)}`, 301)
  }
}

/**
 * Unprefixed-path language fallback ([internal ref]..049).
 *
 * Fires ONLY from a would-be-404 and only when the prefixed target actually
 * resolves, so no existing 404 exit and no locale-agnostic page changes
 * behaviour.
 */
function handleLanguageFallback(app: App, reservedPrefixes: readonly string[]) {
  return async (c: Readonly<Context>, next: () => Promise<void>) => {
    const { path } = c.req
    // `/` has its own negotiated redirect in `setupHomepageRoute`.
    if (path === '/') return next()
    if (isReservedPath(reservedPrefixes, path)) return next()
    // Already carries a locale — this is what makes double-prefixing
    // (`/en/en/docs`) structurally impossible rather than merely unlikely.
    if (validateLanguageSubdirectory(app, path) !== undefined) return next()
    // Resolves as authored: a locale-agnostic page must keep answering in place,
    // or every unprefixed marketing page gains a pointless redirect hop.
    if (resolvesToDeclaredPage(app, path)) return next()

    const language = resolveTargetLanguage(app, c.req.header('Accept-Language'))
    if (language === undefined) return next()
    const target = withLanguagePrefix(language, path)
    // Access-gated: `/private` → 302 `/en/private` where `/nope` → 404 leaks the
    // page's existence, and typing `/en/private` recovers nothing because it
    // 404s for this visitor too.
    if (!resolvesToPublicDeclaredPage(app, target)) return next()

    varyOnAcceptLanguage(c)
    return c.redirect(`${target}${requestSearch(c)}`, 302)
  }
}

/**
 * Mount the trailing-slash normalizer and the unprefixed-path language
 * fallback, in that order.
 *
 * The fallback is skipped entirely (no handler mounted) for an app declaring no
 * `languages`, mirroring `setupRedirectRoutes`' early return: without configured
 * locales there is no prefix to add and the handler could only ever `next()`.
 * The normalizer is ALWAYS mounted — `/manifesto/` 404s in a monolingual app,
 * which is precisely why trailing-slash handling belongs to page routing rather
 * than to i18n.
 */
export function setupUrlCanonicalizationRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app } = config
  // Resolved once, here, and shared by both handlers — see `reservedPrefixesFor`.
  const reservedPrefixes = reservedPrefixesFor(config.adminMounts ?? [])
  const withTrailingSlash = honoApp.get('*', handleTrailingSlash(app, reservedPrefixes))
  if (!app.languages) return withTrailingSlash
  return withTrailingSlash.get('*', handleLanguageFallback(app, reservedPrefixes))
}
