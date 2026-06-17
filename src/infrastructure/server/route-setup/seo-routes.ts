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

const resolveLlmsBaseUrl = (forwardedHost?: string, forwardedProto?: string): string => {
  const fromEnv = Bun.env.BASE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    return `${proto}://${forwardedHost}`.replace(/\/$/, '')
  }

  return ''
}

const isLlmsEnabled = (app: App): boolean => {
  if (app.llms?.enabled === false) return false
  const pages = app.pages ?? []
  return pages.some((page) => page.contentDir !== undefined)
}

export function setupSeoRoutes(honoApp: Readonly<Hono>, app: App): Readonly<Hono> {
  const pages = app.pages ?? []

  const withSeo = honoApp
    .get('/sitemap.xml', async (c) => {
      const baseUrl = resolveBaseUrl(
        c.req.url,
        c.req.header('X-Forwarded-Host') ?? c.req.header('Host'),
        c.req.header('X-Forwarded-Proto')
      )
      const languageOptions = buildLanguageOptions(app)
      const xml = await generateSitemapContent(pages, baseUrl, languageOptions)
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
