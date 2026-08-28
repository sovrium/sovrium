/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type Hono } from 'hono'
import {
  generateSitemapContent,
  generateRobotsContent,
  generateLlmsTxtContent,
  generateLlmsFullTxtContent,
  type HreflangConfig,
} from '@/application/use-cases/server/static-content-generators'
import { resolveRequestBaseUrl } from './resolve-base-url'
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

  return withSeo
    .get('/llms.txt', async (c) => {
      const baseUrl = resolveLlmsBaseUrl(
        c.req.header('X-Forwarded-Host'),
        c.req.header('X-Forwarded-Proto')
      )
      const body = await generateLlmsTxtContent(app, baseUrl)
      return c.body(body, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    })
    .get('/llms-full.txt', async (c) => {
      if (!fullEnabled) return c.notFound()
      const body = await generateLlmsFullTxtContent(app)
      return c.body(body, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    })
}
