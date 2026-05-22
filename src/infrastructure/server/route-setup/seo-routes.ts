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
  type HreflangConfig,
} from '@/application/use-cases/server/static-content-generators'
import type { App } from '@/domain/models/app'

const resolveBaseUrl = (requestUrl: string, host?: string, forwardedProto?: string): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (host) {
    const proto = forwardedProto || 'http'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  return new URL(requestUrl).origin
}

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

export function setupSeoRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const pages = app.pages ?? []

  return honoApp
    .get('/sitemap.xml', (c) => {
      const baseUrl = resolveBaseUrl(
        c.req.url,
        c.req.header('X-Forwarded-Host') ?? c.req.header('Host'),
        c.req.header('X-Forwarded-Proto')
      )
      const languageOptions = buildLanguageOptions(app)
      const xml = generateSitemapContent(pages, baseUrl, languageOptions)
      return c.body(xml, 200, {
        'Content-Type': 'application/xml; charset=utf-8',
      })
    })
    .get('/robots.txt', (c) => {
      const baseUrl = resolveBaseUrl(
        c.req.url,
        c.req.header('X-Forwarded-Host') ?? c.req.header('Host'),
        c.req.header('X-Forwarded-Proto')
      )
      const body = generateRobotsContent(pages, baseUrl, true)
      return c.body(body, 200, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
    })
}
