/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import {
  generateLlmsFullTxtContent,
  generateLlmsTxtContent,
} from '@/application/use-cases/server/llms-txt-content'
import { generateRobotsContent } from '@/application/use-cases/server/robots-content'
import {
  generateSitemapChildContent,
  generateSitemapContent,
} from '@/application/use-cases/server/sitemap-content'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import {
  resolveRequestBaseUrl,
  trustedForwarding,
} from '../../../domain/kernel/url/request-base-url'
import type { FetchSitemapRecords } from '@/application/ports/services/page-renderer'
import type { HreflangConfig } from '@/application/use-cases/server/static-content-generators'
import type { App } from '@/domain/models/app'

/**
 * Build the multilingual hreflang config from the app's language settings.
 *
 * Returns `{ languages, hreflangConfig }` when the app declares languages, or
 * `undefined` for single-language apps (the sitemap then emits plain `<loc>`
 * entries at `${baseUrl}${page.path}`). Mirrors `buildHreflangConfig` in
 * `generate-static-helpers.ts` so the live route and the build path agree.
 */
const buildLanguageOptions = (
  app: App
):
  | { readonly languages: readonly string[]; readonly hreflangConfig: HreflangConfig }
  | undefined => {
  if (!app.languages) return undefined
  const languages = app.languages.supported.map((lang) => lang.code)
  if (languages.length === 0) return undefined
  return {
    languages,
    hreflangConfig: {
      localeMap: Object.fromEntries(
        app.languages.supported.map((lang) => [lang.code, lang.locale ?? lang.code])
      ),
      defaultLanguage: app.languages.default,
    },
  }
}

/**
 * Resolve the base-URL PREFIX for `/llms.txt` page links.
 *
 * Unlike sitemap `<loc>` entries (which are always absolute), the llmstxt.org
 * page bullets default to RELATIVE paths (`/docs/getting-started`) so a docs
 * site served at an unknown origin links cleanly. An absolute prefix is emitted
 * only when the operator declares a canonical origin:
 *  1. `BASE_URL` env var — the canonical production origin.
 *  2. `X-Forwarded-Host` + `X-Forwarded-Proto` — a public origin, believed only
 *     when a declared proxy (`TRUSTED_PROXY_HOPS` >= 1) wrote it; with none
 *     declared the headers are the client's own and are ignored.
 *
 * A bare `Host` header (e.g. `localhost:PORT` from a direct request) does NOT
 * promote links to absolute — it returns `''` (relative). The trailing slash is
 * trimmed so callers can append `${path}` safely.
 */
const resolveLlmsBaseUrl = (header: (name: string) => string | undefined): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const forwarded = trustedForwarding(header)
  if (forwarded.host) {
    return `${forwarded.proto ?? 'https'}://${forwarded.host}`.replace(/\/$/, '')
  }

  return ''
}

/**
 * Whether the `/llms.txt` routes should be served. Auto-derived (default-on)
 * when the app declares at least one content-directory page; disabled when
 * `app.llms.enabled` is explicitly `false`.
 */
const isLlmsEnabled = (app: App): boolean => {
  if (app.llms?.enabled === false) return false
  const pages = app.pages ?? []
  return pages.some((page) => page.contentDir !== undefined)
}

/** Serve the llmstxt.org index for one locale (or every page when `undefined`). */
const respondWithLlmsIndex = async (
  c: Context,
  app: App,
  language: string | undefined
): Promise<Response> => {
  const baseUrl = resolveLlmsBaseUrl((name) => c.req.header(name))
  const body = await runDomainPromise(c, generateLlmsTxtContent(app, baseUrl, language))
  return c.body(body, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
}

/** Serve the concatenated bodies for one locale (or every page when `undefined`). */
const respondWithLlmsFull = async (
  c: Context,
  app: App,
  language: string | undefined
): Promise<Response> => {
  const body = await runDomainPromise(c, generateLlmsFullTxtContent(app, language))
  return c.body(body, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
}

/** How long a computed sitemap document is served before it is rebuilt. */
const SITEMAP_CACHE_TTL_MS = 60_000

/**
 * Most cached documents per app. The key carries the request's origin, which a
 * caller controls through `Host`, so the memo is cleared rather than allowed to
 * grow when an unusual number of origins appear.
 */
const SITEMAP_CACHE_MAX_ENTRIES = 32

/**
 * A per-app memo of computed sitemap documents, keyed by origin and child
 * index. Each app build (a boot, or a config reload) creates its own, so a
 * cached document never outlives the configuration it was computed from.
 */
const createSitemapCache = () => {
  const entries = new Map<
    string,
    { readonly expiresAt: number; readonly xml: string | undefined }
  >()
  return async (
    key: string,
    compute: () => Promise<string | undefined>
  ): Promise<string | undefined> => {
    const now = Date.now()
    const hit = entries.get(key)
    if (hit !== undefined && hit.expiresAt > now) return hit.xml
    const xml = await compute()
    if (entries.size >= SITEMAP_CACHE_MAX_ENTRIES) entries.clear()
    entries.set(key, { expiresAt: now + SITEMAP_CACHE_TTL_MS, xml })
    return xml
  }
}

/**
 * `/sitemap.xml`, and the `/sitemap-N.xml` children an app past 5 000 URLs is
 * split into. The regex keeps the child route from claiming any other root
 * file; an index out of range, or any child of an app that fits in one
 * `/sitemap.xml`, answers 404.
 *
 * Both are served from {@link createSitemapCache} for {@link SITEMAP_CACHE_TTL_MS}:
 * the record fan-out reads the database, and an anonymous request must not be
 * able to trigger that read on every hit.
 */
const setupSitemapRoutes = (
  honoApp: Readonly<Hono>,
  app: App,
  fetchSitemapRecords: FetchSitemapRecords | undefined
): Readonly<Hono> => {
  const pages = app.pages ?? []
  const sitemapOptions = {
    ...buildLanguageOptions(app),
    app,
    ...(fetchSitemapRecords !== undefined ? { fetchRecords: fetchSitemapRecords } : {}),
  }
  const cached = createSitemapCache()
  const xmlHeaders = { 'Content-Type': 'application/xml; charset=utf-8' }
  return honoApp
    .get('/sitemap.xml', async (c) => {
      const baseUrl = resolveRequestBaseUrl(c)
      const xml = await cached(`${baseUrl}#0`, () =>
        runDomainPromise(c, generateSitemapContent(pages, baseUrl, sitemapOptions))
      )
      return c.body(xml ?? '', 200, xmlHeaders)
    })
    .get('/:file{sitemap-[0-9]+\\.xml}', async (c) => {
      const index = Number(/\d+/.exec(c.req.param('file'))?.[0] ?? '0')
      const baseUrl = resolveRequestBaseUrl(c)
      const xml = await cached(`${baseUrl}#${String(index)}`, () =>
        runDomainPromise(c, generateSitemapChildContent(pages, baseUrl, index, sitemapOptions))
      )
      return xml === undefined ? c.notFound() : c.body(xml, 200, xmlHeaders)
    })
}

/**
 * Setup live SEO routes (`/sitemap.xml`, `/robots.txt`, `/llms.txt`,
 * `/llms-full.txt`) for server mode.
 *
 * These mirror the files `sovrium build` emits but are generated on every
 * request from the live `app.pages`. They reuse the pure generators in
 * `static-content-generators.ts` (no duplicated XML/policy/llms logic).
 *
 * Mounted BEFORE the public-directory catch-all so a generated route always
 * wins over a same-named static file in the public directory.
 *
 * The `/llms.txt` routes are conditionally mounted: only when content-directory
 * pages exist and `app.llms.enabled` is not `false`. When disabled, the routes
 * are never registered, so a request falls through to the public catch-all (a
 * 404 when no same-named static file exists).
 *
 * They are also LOCALE-SCOPED. The root pair serves `languages.default`, and
 * every declared `languages.supported[].code` gets its own pair at
 * `/{lang}/llms.txt` + `/{lang}/llms-full.txt` — so an agent reads one corpus
 * in the language it asked for rather than one document carrying every
 * translation. An app declaring no `languages` registers the root pair alone
 * and serves every content-directory page there, exactly as before.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration
 * @returns Hono app with the SEO routes configured
 */
export function setupSeoRoutes(
  honoApp: Readonly<Hono>,
  app: App,
  fetchSitemapRecords?: FetchSitemapRecords
): Readonly<Hono> {
  const pages = app.pages ?? []
  const withSeo = setupSitemapRoutes(honoApp, app, fetchSitemapRecords).get('/robots.txt', (c) => {
    const baseUrl = resolveRequestBaseUrl(c)
    const body = generateRobotsContent(pages, baseUrl, true)
    return c.body(body, 200, {
      'Content-Type': 'text/plain; charset=utf-8',
    })
  })

  if (!isLlmsEnabled(app)) return withSeo

  const fullEnabled = app.llms?.full !== false
  const defaultLanguage = app.languages?.default

  const withRootLlms = withSeo
    .get('/llms.txt', (c) => respondWithLlmsIndex(c, app, defaultLanguage))
    .get('/llms-full.txt', async (c) => {
      if (!fullEnabled) return c.notFound()
      return respondWithLlmsFull(c, app, defaultLanguage)
    })

  // One pair per DECLARED language code, the default included, so an agent can
  // build the address from a language code with no special case. An app that
  // declares no `languages` registers none, and `/en/llms.txt` then falls
  // through to the dynamic-page catch-all exactly as `/en/docs` would — a 404.
  //
  // Registration position is load-bearing and already satisfied by the caller:
  // `compose-hono-app.ts` chains `setupSeoRoutes` INSIDE `setupPageRoutes`, so
  // these register before the `/:lang/*` page route that would otherwise claim
  // the path. Same constraint `markdown-export-routes.ts` documents for the
  // `.md` twins.
  const declaredCodes = app.languages?.supported.map((language) => language.code) ?? []

  return declaredCodes.reduce<Readonly<Hono>>(
    (chained, code) =>
      chained
        .get(`/${code}/llms.txt`, (c) => respondWithLlmsIndex(c, app, code))
        .get(`/${code}/llms-full.txt`, async (c) => {
          if (!fullEnabled) return c.notFound()
          return respondWithLlmsFull(c, app, code)
        }),
    withRootLlms
  )
}
