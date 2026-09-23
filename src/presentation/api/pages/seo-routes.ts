/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Context, type Hono } from 'hono'
import {
  generateSitemapContent,
  generateRobotsContent,
  generateLlmsTxtContent,
  generateLlmsFullTxtContent,
  type HreflangConfig,
} from '@/application/use-cases/server/static-content-generators'
import { resolveRequestBaseUrl } from '../../../domain/kernel/url/request-base-url'
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
 *  2. `X-Forwarded-Host` + `X-Forwarded-Proto` — a reverse-proxy-declared
 *     public origin.
 *
 * A bare `Host` header (e.g. `localhost:PORT` from a direct request) does NOT
 * promote links to absolute — it returns `''` (relative). The trailing slash is
 * trimmed so callers can append `${path}` safely.
 */
const resolveLlmsBaseUrl = (forwardedHost?: string, forwardedProto?: string): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    return `${proto}://${forwardedHost}`.replace(/\/$/, '')
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
  const baseUrl = resolveLlmsBaseUrl(
    c.req.header('X-Forwarded-Host'),
    c.req.header('X-Forwarded-Proto')
  )
  const body = await generateLlmsTxtContent(app, baseUrl, language)
  return c.body(body, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
}

/** Serve the concatenated bodies for one locale (or every page when `undefined`). */
const respondWithLlmsFull = async (
  c: Context,
  app: App,
  language: string | undefined
): Promise<Response> => {
  const body = await generateLlmsFullTxtContent(app, language)
  return c.body(body, 200, { 'Content-Type': 'text/plain; charset=utf-8' })
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
export function setupSeoRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const pages = app.pages ?? []

  const withSeo = honoApp
    .get('/sitemap.xml', async (c) => {
      const baseUrl = resolveRequestBaseUrl(c)
      const languageOptions = buildLanguageOptions(app)
      const xml = await generateSitemapContent(pages, baseUrl, languageOptions)
      return c.body(xml, 200, {
        'Content-Type': 'application/xml; charset=utf-8',
      })
    })
    .get('/robots.txt', (c) => {
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
