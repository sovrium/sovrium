/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { requestedPath } from '@/domain/kernel/url/requested-path'
import {
  LANGUAGE_PREFERENCE_COOKIE,
  detectLanguageIfEnabled,
  findDeclaredLanguageCode,
  resolvePreferredLanguage,
  validateLanguageSubdirectory,
} from '@/domain/models/app/languages/language-detection'
import { listFeedPaths } from '@/domain/models/app/pages/rss-feed-builder'
import { isProduction as isProductionEnv } from '@/infrastructure/process/env'
import { isPublicOrigin } from '@/infrastructure/process/security-posture'
import { applyCredentialedPageIpCeiling } from '@/presentation/api/middleware/api-ip-ceiling'
import { answerRenderFailure } from '@/presentation/api/runtime/render-failure-answer'
import { resolveRequestBaseUrl } from '@/presentation/api/runtime/request-origin'
import { varyOnAcceptLanguage, varyOnCookie } from '@/presentation/api/runtime/vary'
import { queryMasksReader } from './caller-table-reader'
import { setupContentDirIndexRedirectRoutes } from './content-dir-index-redirect-routes'
import { applyFormFlash } from './form-flash-middleware'
import { answerLanguageRemainder, answerNotFound } from './language-remainder-route'
import { setupMarkdownExportRoutes } from './markdown-export-routes'
import {
  extractSession,
  renderTracedPage,
  renderWithCache,
  resolvePreviewMode,
} from './page-render-pipeline'
import { setupUrlCanonicalizationRoutes } from './url-canonicalization-routes'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * The persisted language preference, for a request carrying NO `/{lang}/`
 * prefix — and the `Vary: Cookie` that goes with honouring one.
 *
 * TWO stores, ranked: the signed-in reader's ACCOUNT first, then this browser's
 * cookie. See the body for why that order and not the other.
 *
 * It is threaded on as `urlLanguage` rather than through a channel of its own,
 * and that is a decision rather than a shortcut: `urlLanguage` is not "the URL
 * said so", it is "this ranks ABOVE the page's own `meta.lang`", which is
 * exactly where a preference belongs. Every consumer —
 * the locale resolver, the component filter that resolves `$t:` against the
 * active language, and the page cache key, which must vary or the first
 * visitor's language is served to the next — already reads that one field.
 *
 * Called ONLY from the two unprefixed routes. The `/:lang/` handlers own
 * `urlLanguage` for a second purpose (they strip the segment off the path and
 * 404 without it), and there the URL has already spoken: a preference must not
 * contradict an address a visitor typed, shared or was linked to.
 *
 * `Vary` is declared whenever the cookie was CONSULTED, not only when it
 * decided — a cache that stored the no-preference render under the bare path
 * would serve it to the next visitor either way.
 */
const preferredLanguageFor = (
  config: HonoAppConfig,
  cookies: Readonly<Record<string, string>>,
  c: Context,
  session: SessionInfo | undefined
): string | undefined => {
  const { languages } = config.app
  if (!languages || languages.persistSelection === false) return undefined
  varyOnCookie(c)
  // The ACCOUNT outranks the browser. A preference saved on an account is a
  // deliberate statement that travels to every machine its owner signs in on;
  // the cookie is what one particular browser happens to remember. When they
  // disagree, the considered one wins.
  //
  // Both go through the same resolver, so both are clamped to what THIS app
  // declares and both stop dead under `persistSelection: false`. A second copy
  // of that rule here is exactly how the two stores would come to disagree
  // about what "do not remember" means.
  //
  // `Vary: Cookie` covers this too: the session travels as a cookie, so a cache
  // keyed on it already tells two signed-in readers apart.
  return (
    resolvePreferredLanguage(languages, session?.language) ??
    resolvePreferredLanguage(languages, cookies[LANGUAGE_PREFERENCE_COOKIE])
  )
}

/**
 * The language a not-found page is composed in when the path carried NO
 * declared `/{lang}/` segment: the remembered preference first, then the
 * browser. A 404 is still read by someone, and a French operator who mistyped
 * an address is owed the French page.
 */
const notFoundLanguage = (
  config: HonoAppConfig,
  c: Context,
  request: {
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>>
  }
): string | undefined =>
  preferredLanguageFor(config, request.cookies, c, request.session) ??
  detectLanguageIfEnabled(config.app, c.req.header('Accept-Language'))

/**
 * The `/{lang}/` segment a remembered choice should be READ at, or `undefined`
 * when the bare path is already the right address for it.
 *
 * ─── WHY A PREFERENCE REDIRECTS AT ALL ─────────────────────────────────────
 *
 * A remembered choice and a detected one are the same kind of answer — "this
 * reader wants French" — and detection has always redirected. A preference that
 * rendered in place instead left one reader on a URL that serves them something
 * nobody else gets: not shareable, not bookmarkable, and not somewhere they can
 * be sent back to. Naming the address is what makes the two answers agree.
 *
 * ─── THE CODE, NOT THE LOCALE ──────────────────────────────────────────────
 *
 * The preference arrives resolved to `supported[].locale`, because that is what
 * the DOCUMENT declares itself as. An address is spelled differently:
 * `/{lang}/` routing validates its segment against `supported[].code`, so a
 * target built from the locale reads `/fr-FR/`, which matches no route and
 * 404s. `findDeclaredLanguageCode` is the address half of that pair.
 *
 * ─── AND WHY THE DEFAULT LANGUAGE STAYS PUT ────────────────────────────────
 *
 * Redirecting `/` to `/en/` for a reader who chose the default gains nothing —
 * the bare path already serves exactly that document — and costs a second
 * canonical URL for one page. Browser detection declines the same redirect for
 * the same reason, and the two are deliberately kept in step.
 */
const preferredAddressFor = (
  languages: HonoAppConfig['app']['languages'],
  preference: string | undefined
): string | undefined => {
  const code = findDeclaredLanguageCode(languages, preference)
  if (code === undefined) return undefined
  const defaultCode = findDeclaredLanguageCode(languages, languages?.default) ?? languages?.default
  return code === defaultCode ? undefined : code
}

/**
 * Setup homepage route
 */
export function setupHomepageRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderErrorPage } = config

  return honoApp.get('/', async (c) => {
    try {
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const previewMode = resolvePreviewMode(c, session)
      const urlLanguage = preferredLanguageFor(config, cookies, c, session)
      const reqCtx = {
        session,
        cookies,
        previewMode,
        requestQuery: c.req.query(),
        ...(urlLanguage ? { urlLanguage } : {}),
      }
      // Both non-redirecting exits below are the same one; naming it once keeps
      // them from drifting apart and keeps this handler inside its complexity
      // budget now that a third branch shares it. A root that renders nothing —
      // a declared homepage whose own record this caller cannot read — is the
      // ordinary 404, exactly as any other path that renders nothing.
      const renderRoot = async (): Promise<Response> =>
        (await renderTracedPage(c, config, '/', reqCtx)) ??
        answerNotFound(config, c, urlLanguage, session)

      // A remembered choice names its own address, whatever detection is doing.
      // This sits ABOVE the guard below on purpose: that guard is a statement
      // about DETECTION, and a preference is not a guess — an app that turned
      // browser sniffing off has not asked to forget what its reader chose.
      // `Vary: Cookie` is already declared by `preferredLanguageFor`, which
      // must run before any response helper builds the headers.
      const preferredAddress = preferredAddressFor(app.languages, urlLanguage)
      if (preferredAddress !== undefined) {
        return c.redirect(`/${preferredAddress}/`, 302)
      }

      if (!app.languages || app.languages.detectBrowser === false) {
        return await renderRoot()
      }

      // Placed AFTER the guard above and BEFORE the
      // branch below so it covers BOTH outcomes. A monolingual app (or
      // `detectBrowser: false`) never reaches here and emits no `Vary`, which is
      // correct: neither of its branches reads the header.
      //
      // The 200 branch matters as much as the 302. It ships
      // `Cache-Control: public, max-age=300`, so a shared cache stores the
      // English `/` under the bare `/` key and serves it to a French visitor
      // whose redirect then never runs at all.
      varyOnAcceptLanguage(c)

      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      const targetLanguage = detectedLanguage || app.languages.default

      // A CHOICE outranks a GUESS. The redirect below is browser detection, and
      // sending a visitor who has explicitly picked a language to the locale
      // their browser happens to advertise would overrule that pick with a
      // header they never set — and do it through a URL, which then wins over
      // the preference for good.
      if (targetLanguage !== app.languages.default && urlLanguage === undefined) {
        return c.redirect(`/${targetLanguage}/`, 302)
      }

      return await renderRoot()
    } catch (error) {
      return answerRenderFailure(c, error, (requestId) =>
        renderErrorPage(app, undefined, requestId)
      )
    }
  })
}

/**
 * Handle the bare `/:lang` route (no trailing slash).
 *
 * A language-prefixed root requested WITHOUT a trailing
 * slash (e.g. `/en`) permanently redirects (301) to its canonical
 * trailing-slash form (`/en/`), which is the surface the language homepage
 * route serves. This keeps a single canonical URL per language root for SEO
 * and avoids the language homepage being reachable under two distinct paths.
 *
 * The redirect fires ONLY when the single path segment is a
 * configured app language. A non-language single segment (e.g. `/about`) is
 * passed through to the catch-all via `next()` so ordinary top-level pages are
 * untouched by the trailing-slash rule.
 */
function handleBareLanguageRoute(config: HonoAppConfig) {
  const { app } = config
  return async (c: Context, next: () => Promise<void>) => {
    const urlLanguage = validateLanguageSubdirectory(app, c.req.path)
    if (urlLanguage === undefined) {
      return next()
    }
    return c.redirect(`/${urlLanguage}/`, 301)
  }
}

/**
 * Handle /:lang/ route (homepage in specific language)
 */
function handleLanguageHomepageRoute(config: HonoAppConfig) {
  const { app, renderErrorPage } = config
  return async (c: Context) => {
    try {
      const { path } = c.req
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      // On exact `/:lang/` matches, the URL prefix is authoritative for locale —
      // it must beat the browser Accept-Language so `/en/` never renders French,
      // and it is passed on as `urlLanguage` so it also beats a page's own
      // `meta.lang`.
      const urlLanguage = validateLanguageSubdirectory(app, path)
      const base = {
        session,
        cookies,
        previewMode: resolvePreviewMode(c, session),
        requestQuery: c.req.query(),
        urlLanguage,
      }
      const exact = await renderWithCache(
        config,
        path,
        { ...base, detectedLanguage: urlLanguage ?? detectedLanguage },
        c
      )
      if (exact) return exact
      if (!urlLanguage) {
        return answerNotFound(config, c, notFoundLanguage(config, c, base), session)
      }
      const lang = await renderWithCache(config, '/', { ...base, detectedLanguage: urlLanguage }, c)
      return lang ?? answerNotFound(config, c, urlLanguage, session)
    } catch (error) {
      const detectedLang = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return answerRenderFailure(c, error, (id) => renderErrorPage(app, detectedLang, id))
    }
  }
}

/**
 * Handle /:lang/* route (pages in specific language)
 */
function handleLanguagePageRoute(config: HonoAppConfig) {
  const { app, renderErrorPage } = config
  return async (c: Context) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    // A `/:lang/` prefix beats Accept-Language and `meta.lang`. `/:lang/*` also
    // matches a prefix-less `/archive`: there the remembered choice takes its rank.
    const urlLanguage = validateLanguageSubdirectory(app, path)
    const ranked = urlLanguage ?? preferredLanguageFor(config, cookies, c, session)
    const base = {
      session,
      cookies,
      previewMode: resolvePreviewMode(c, session),
      requestQuery: c.req.query(),
      urlLanguage,
    }
    try {
      const exact = await renderWithCache(
        config,
        path,
        { ...base, urlLanguage: ranked, detectedLanguage: urlLanguage ?? detectedLanguage },
        c
      )
      if (exact) return exact
      if (!urlLanguage) {
        return answerNotFound(config, c, ranked ?? detectedLanguage, session)
      }
      return await answerLanguageRemainder(config, c, base, urlLanguage)
    } catch (error) {
      return answerRenderFailure(c, error, (id) => renderErrorPage(app, detectedLanguage, id))
    }
  }
}

/**
 * Setup language subdirectory routes
 */
export function setupLanguageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  return honoApp
    .get('/:lang', handleBareLanguageRoute(config))
    .get('/:lang/', handleLanguageHomepageRoute(config))
    .get('/:lang/*', handleLanguagePageRoute(config))
}

/**
 * Setup dynamic page routes
 */
export function setupDynamicPageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app } = config

  return honoApp.get('*', async (c) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    const previewMode = resolvePreviewMode(c, session)
    const requestQuery = c.req.query()
    const urlLanguage = preferredLanguageFor(config, cookies, c, session)
    const response = await renderWithCache(
      config,
      path,
      {
        detectedLanguage,
        session,
        cookies,
        previewMode,
        requestQuery,
        ...(urlLanguage ? { urlLanguage } : {}),
      },
      c
    )
    // A path that names no page is still read by someone: the not-found page
    // speaks the reader's remembered language before the browser's guess, the
    // same rank every declared page applies.
    return response ?? answerNotFound(config, c, urlLanguage ?? detectedLanguage, session)
  })
}

/**
 * Setup the RSS endpoints: `/feed.xml`, and every address a page names with
 * `rss.path` (a gated page's too, so it answers the standard 404). Mounted
 * BEFORE the language routes and the catch-all (`*`), which would otherwise
 * swallow `/journal/feed.xml`; a reload builds a new app, so the addresses
 * read here never go stale. XML answers `200 application/rss+xml`; no public
 * page publishing at the address answers the standard not-found page (404);
 * an error is logged and answers the standard error page (500).
 */
export function setupRssFeedRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderRssFeed, renderNotFoundPage, renderErrorPage } = config

  return listFeedPaths(app).reduce<Readonly<Hono>>(
    (routes, feedPath) =>
      routes.get(feedPath, async (c) => {
        const notFound = async () =>
          c.html(await renderNotFoundPage(app, undefined, requestedPath(c.req.url)), 404)
        if (!renderRssFeed) return notFound()
        try {
          // `BASE_URL` first, as the sitemap: the feed advertises the canonical
          // address, not the internal one a proxied request came in on.
          const baseUrl = resolveRequestBaseUrl(c)
          const xml = await renderRssFeed(app, baseUrl, queryMasksReader(c), feedPath)
          if (xml === undefined) return notFound()
          return c.body(xml, 200, {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
          })
        } catch (error) {
          return answerRenderFailure(c, error, (requestId) =>
            renderErrorPage(app, undefined, requestId)
          )
        }
      }),
    honoApp
  )
}

/**
 * Setup test error route: a deliberate 500 for a developer's own server. Any
 * public origin answers the not-found page instead, whatever `NODE_ENV` says —
 * the binary never sets it — and `NODE_ENV=production` closes it on loopback.
 */
export function setupTestErrorRoute(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app, renderNotFoundPage } = config

  return honoApp.get('/test/error', (c) => {
    if (isProductionEnv() || isPublicOrigin()) {
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(renderNotFoundPage(app, detectedLanguage, requestedPath(c.req.url)), 404)
    }
    throw new Error('Test error')
  })
}

/**
 * Chains the embedded console's mount onto a Hono instance, or returns it
 * untouched when the console is not served.
 *
 * INJECTED rather than imported (W5c). The registrar lives in
 * `presentation/api/admin/mount-routes.ts`, beside the handlers it chains, and
 * this module is still in `infrastructure/`; importing it directly would be the
 * reverse-arrow edge the wave exists to remove. The same inversion closed
 * `register-agent-schedules.ts` in W5b — the callback is supplied by
 * `compose-hono-app.ts`, a pinned composition root that may already reach
 * presentation, so the EDGE moves instead of the file.
 *
 * It stays injected after `page-routes.ts` itself moves: `admin` is a different
 * slug from `pages`, so a direct import would be a cross-slug edge there too.
 */
type MountRegistrar = (honoApp: Readonly<Hono>, config: HonoAppConfig) => Readonly<Hono>

/**
 * Setup page routes (homepage, RSS feed, language subdirectories, dynamic pages)
 *
 * Order is significant — Hono dispatches in registration order and the
 * `/:lang/*` route from `setupLanguageRoutes` matches `/feed.xml` (with
 * `:lang = feed.xml`, `* = empty`). `setupRssFeedRoute` therefore has to
 * be registered BEFORE language routes (and before the catch-all `*` in
 * `setupDynamicPageRoutes`) so the RSS handler wins the match.
 */
export function setupPageRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig,
  setupAdminMountRoutes: MountRegistrar
): Readonly<Hono> {
  return setupDynamicPageRoutes(
    setupLanguageRoutes(
      // trailing-slash normalization + the unprefixed-path language fallback.
      // AFTER the `contentDir.index` 301 and BEFORE the language
      // routes: `/:lang/*` is terminal — it 404s rather than calling `next()` —
      // so a canonicalizing catch-all mounted after it would be dead code for
      // every two-plus-segment path, and `/manifesto/` matches it with
      // `lang = 'manifesto'` so single-segment paths would be missed too.
      // Mounted here rather than at the `server.ts` redirect position because
      // `/_admin` is registered INSIDE this function and would be shadowed.
      setupUrlCanonicalizationRoutes(
        // The pages layout markdown pages requirement: the server-mode 301 that
        // sends a `contentDir.index` article's slugged URL (`/docs/introduction`)
        // to the collection base path (`/docs`). Registered AFTER the `.md` export
        // route (so the index article's `.md`/`Accept` twins still serve raw
        // markdown 200) and BEFORE the language + catch-all routes. Falls through
        // (`next()`) for every non-index request.
        setupContentDirIndexRedirectRoutes(
          // The per-page `.md` export twin is registered BEFORE the language routes and
          // the catch-all (`*`), where a `.md` path matches no page and would 404. It
          // falls through (`next()`) for every other request.
          setupMarkdownExportRoutes(
            // [internal ref] / founder decision D1: the embedded-console mount
            // (`/_admin`, unless `admin: false` or `SOVRIUM_ADMIN=off` take it
            // away) is registered BEFORE the language routes and the
            // dynamic-page catch-all (`*`), so the mount wins over the
            // operator's own page resolution and a `/{lang}/*` route cannot
            // swallow it. The mount is independent of, and never shadowed by,
            // the operator's config.
            setupAdminMountRoutes(
              setupRssFeedRoute(
                setupTestErrorRoute(
                  // The per-address ceiling for requests that carry a credential,
                  // ahead of every route that looks a session up; then a form's
                  // carried toast, drawn on the page its POST lands on.
                  setupHomepageRoute(
                    applyFormFlash(applyCredentialedPageIpCeiling(honoApp as Hono)),
                    config
                  ),
                  config
                ),
                config
              ),
              config
            ),
            config
          ),
          config
        ),
        config
      ),
      config
    ),
    config
  )
}
