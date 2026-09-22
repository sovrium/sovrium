/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  LANGUAGE_PREFERENCE_COOKIE,
  detectLanguageIfEnabled,
  findDeclaredLanguageCode,
  resolvePreferredLanguage,
  validateLanguageSubdirectory,
} from '@/domain/models/app/languages/language-detection'
import { buildRobotsTxt, buildSitemapXml } from '@/domain/models/app/pages/sitemap-builder'
import { logError } from '@/infrastructure/logging/logger'
import { isProduction as isProductionEnv } from '@/infrastructure/process/env'
import { varyOnAcceptLanguage, varyOnCookie } from '@/presentation/api/runtime/vary'
import { setupContentDirIndexRedirectRoutes } from './content-dir-index-redirect-routes'
import { setupMarkdownExportRoutes } from './markdown-export-routes'
import {
  ERROR_PAGE_STATUS,
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
      // budget now that a third branch shares it.
      const renderRoot = async (): Promise<Response> =>
        (await renderTracedPage(c, config, '/', reqCtx)) ?? c.html('')

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

      // [internal ref] — placed AFTER the guard above and BEFORE the
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
      logError(`[server] GET / → ${ERROR_PAGE_STATUS} Error rendering homepage`, error)
      return c.html(await renderErrorPage(app), ERROR_PAGE_STATUS)
    }
  })
}

/**
 * Handle the bare `/:lang` route (no trailing slash).
 *
 * [internal ref]: a language-prefixed root requested WITHOUT a trailing
 * slash (e.g. `/en`) permanently redirects (301) to its canonical
 * trailing-slash form (`/en/`), which is the surface the language homepage
 * route serves. This keeps a single canonical URL per language root for SEO
 * and avoids the language homepage being reachable under two distinct paths.
 *
 * [internal ref]: the redirect fires ONLY when the single path segment is a
 * configured app language. A non-language single segment (e.g. `/about`) is
 * passed through to the catch-all via `next()` so ordinary top-level pages are
 * untouched by the trailing-slash rule.
 */
function handleBareLanguageRoute(config: HonoAppConfig) {
  const { app } = config
  return async (c: Readonly<Context>, next: () => Promise<void>) => {
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
  const { app, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    try {
      const { path } = c.req
      const session = await extractSession(config, c.req.raw.headers)
      const cookies = getCookie(c)
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      // On exact `/:lang/` matches, the URL prefix is authoritative for locale —
      // it must beat the browser Accept-Language so `/en/` never renders French,
      // and it is passed on as `urlLanguage` so it also beats a page's own
      // `meta.lang` ([internal ref]..039).
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
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const lang = await renderWithCache(config, '/', { ...base, detectedLanguage: urlLanguage }, c)
      return lang ?? c.html('')
    } catch (error) {
      logError(`[server] GET ${c.req.path} → ${ERROR_PAGE_STATUS} Error rendering homepage`, error)
      const detectedLang = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(await renderErrorPage(app, detectedLang), ERROR_PAGE_STATUS)
    }
  }
}

/**
 * Handle /:lang/* route (pages in specific language)
 */
function handleLanguagePageRoute(config: HonoAppConfig) {
  const { app, renderNotFoundPage, renderErrorPage } = config
  return async (c: Readonly<Context>) => {
    const { path } = c.req
    const session = await extractSession(config, c.req.raw.headers)
    const cookies = getCookie(c)
    const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
    // On exact `/:lang/...` matches, the URL prefix is authoritative for locale —
    // it must beat the browser Accept-Language so `/en/...` never renders French,
    // and it is passed on as `urlLanguage` so it also beats a page's own
    // `meta.lang` ([internal ref]..039).
    const urlLanguage = validateLanguageSubdirectory(app, path)
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
        { ...base, detectedLanguage: urlLanguage ?? detectedLanguage },
        c
      )
      if (exact) return exact
      if (!urlLanguage) {
        return c.html(await renderNotFoundPage(app, detectedLanguage), 404)
      }
      const pathWithoutLang = path.replace(`/${urlLanguage}`, '') || '/'
      const lang = await renderWithCache(
        config,
        pathWithoutLang,
        { ...base, detectedLanguage: urlLanguage },
        c
      )
      return lang ?? c.html(await renderNotFoundPage(app, urlLanguage), 404)
    } catch (error) {
      logError(`[server] GET ${path} → ${ERROR_PAGE_STATUS} Error rendering page`, error)
      return c.html(await renderErrorPage(app, detectedLanguage), ERROR_PAGE_STATUS)
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
  const { app, renderNotFoundPage } = config

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
    return response ?? c.html(await renderNotFoundPage(app, detectedLanguage), 404)
  })
}

/**
 * Setup the `/feed.xml` RSS endpoint.
 *
 * Mounted BEFORE the dynamic-page catch-all (`*`) so the rss handler wins
 * the route match — the catch-all would otherwise treat `/feed.xml` as a
 * page path and 404 because no page declares that path.
 *
 * Behaviour:
 *   - When `config.renderRssFeed` is provided AND it returns an XML
 *     string, respond `200 application/rss+xml`.
 *   - When the renderer returns `undefined` (no opted-in collection page),
 *     fall through to a 404 rendered with the standard not-found page so
 *     the response stays consistent with other unmapped paths.
 *   - Errors are logged and surfaced as a 500 via the standard error page.
 */
export function setupRssFeedRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app, renderRssFeed, renderNotFoundPage, renderErrorPage } = config

  return honoApp.get('/feed.xml', async (c) => {
    if (!renderRssFeed) {
      return c.html(await renderNotFoundPage(app), 404)
    }
    try {
      const url = new URL(c.req.url)
      const baseUrl = `${url.protocol}//${url.host}`
      const xml = await renderRssFeed(app, baseUrl)
      if (xml === undefined) {
        return c.html(await renderNotFoundPage(app), 404)
      }
      return c.body(xml, 200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      })
    } catch (error) {
      logError(`[server] GET /feed.xml → ${ERROR_PAGE_STATUS} Error rendering RSS feed`, error)
      return c.html(await renderErrorPage(app), ERROR_PAGE_STATUS)
    }
  })
}

/**
 * Setup the `/sitemap.xml` endpoint.
 *
 * Generates an XML sitemap from the app's pages, honouring each page's
 * per-page `sitemap` config (priority, changefreq, or `false` to exclude).
 *
 * Mounted BEFORE the language routes (`/:lang/*`) and the dynamic-page
 * catch-all (`*`) for the same reason as the RSS feed: `/:lang/*` would
 * otherwise match `/sitemap.xml` with `:lang = sitemap.xml`.
 */
export function setupSitemapRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app } = config

  return honoApp.get('/sitemap.xml', (c) => {
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    // Clock injected at the boundary so the domain builder stays a pure
    // function of its inputs.
    const xml = buildSitemapXml(app.pages ?? [], baseUrl, new Date())
    return c.body(xml, 200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    })
  })
}

/**
 * Setup the `/robots.txt` endpoint ([internal ref] — [internal ref]).
 *
 * Auto-generates robots.txt with a reference to `/sitemap.xml`. Registered
 * before the language and catch-all routes for the same routing reason as
 * the sitemap endpoint.
 */
export function setupRobotsRoute(honoApp: Readonly<Hono>, config: HonoAppConfig): Readonly<Hono> {
  const { app } = config

  return honoApp.get('/robots.txt', (c) => {
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const body = buildRobotsTxt(app.pages ?? [], baseUrl)
    return c.body(body, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    })
  })
}

/**
 * Setup test error route
 */
export function setupTestErrorRoute(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  const { app, renderNotFoundPage } = config

  return honoApp.get('/test/error', (c) => {
    if (isProductionEnv()) {
      const detectedLanguage = detectLanguageIfEnabled(app, c.req.header('Accept-Language'))
      return c.html(renderNotFoundPage(app, detectedLanguage), 404)
    }
    // eslint-disable-next-line functional/no-throw-statements
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
      // [internal ref]: trailing-slash normalization + the unprefixed-path language
      // fallback. Registered AFTER the `contentDir.index` 301 (whose shipped
      // placement is the precedent for this slot) and BEFORE the language
      // routes: `/:lang/*` is terminal — it 404s rather than calling `next()` —
      // so a canonicalizing catch-all mounted after it would be dead code for
      // every two-plus-segment path, and `/manifesto/` matches it with
      // `lang = 'manifesto'` so single-segment paths would be missed too.
      // Mounted here rather than at the `server.ts` redirect position because
      // `/_admin` is registered INSIDE this function and would be shadowed.
      setupUrlCanonicalizationRoutes(
        // [internal ref]: the server-mode 301 that
        // sends a `contentDir.index` article's slugged URL (`/docs/introduction`)
        // to the collection base path (`/docs`). Registered AFTER the `.md` export
        // route (so the index article's `.md`/`Accept` twins still serve raw
        // markdown 200) and BEFORE the language + catch-all routes. Falls through
        // (`next()`) for every non-index request.
        setupContentDirIndexRedirectRoutes(
          // [internal ref]: the per-page `.md` export twin is
          // registered BEFORE the language routes and the dynamic-page catch-all
          // (`*`) — a `.md` path matches no page pattern and would otherwise 404
          // through the catch-all. It falls through (`next()`) for every non-export
          // request, so ordinary page resolution is untouched.
          setupMarkdownExportRoutes(
            // [internal ref] / founder decision D1: the embedded-console mount
            // (`/_admin`, unless `admin: false` or `SOVRIUM_ADMIN=off` take it
            // away) is registered BEFORE the language routes and the
            // dynamic-page catch-all (`*`), so the mount wins over the
            // operator's own page resolution and a `/{lang}/*` route cannot
            // swallow it. The mount is independent of, and never shadowed by,
            // the operator's config.
            setupAdminMountRoutes(
              setupRobotsRoute(
                setupSitemapRoute(
                  setupRssFeedRoute(
                    setupTestErrorRoute(setupHomepageRoute(honoApp, config), config),
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
