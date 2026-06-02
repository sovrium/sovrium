/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { getCookie } from 'hono/cookie'
import {
  parseEcoLowDataDefault,
  resolveLowDataMode,
  type LowDataSignals,
} from '@/domain/models/env/eco-low-data-default'
import type { Context, MiddlewareHandler, Next } from 'hono'

const LOW_DATA_COOKIE_NAME = 'sovrium_low_data'
const HEAVY_ISLANDS: readonly string[] = ['chart', 'calendar', 'rich-text-display']
const OPT_OUT_PATH = '/__sovrium/eco/low-data-opt-out'

function readLowDataCookie(c: Context): 'on' | 'off' | undefined {
  const cookies = getCookie(c as unknown as Parameters<typeof getCookie>[0])
  const raw = cookies[LOW_DATA_COOKIE_NAME]
  return raw === 'on' || raw === 'off' ? raw : undefined
}

function collectSignals(c: Context): LowDataSignals {
  return {
    saveData: c.req.header('save-data'),
    clientHint: c.req.header('sec-ch-prefers-reduced-data'),
    cookie: readLowDataCookie(c),
  }
}

function injectFooterBadge(html: string, currentPath: string): string {
  const next = encodeURIComponent(currentPath)
  const badge = `<div data-eco-low-data-badge="true" data-fallback="data-table" style="position:fixed;bottom:0;left:0;right:0;padding:8px;text-align:center;background:#f3f4f6;border-top:1px solid #e5e7eb;font-size:12px;">Low-data mode active. <a href="${OPT_OUT_PATH}?next=${next}" rel="nofollow">Show full version</a></div>`
  if (html.includes('</body>')) return html.replace('</body>', `${badge}</body>`)
  return `${html}${badge}`
}

function downshiftIslands(html: string): string {
  return HEAVY_ISLANDS.reduce(
    (acc, island) =>
      acc.replace(new RegExp(`data-island="${island}"`, 'g'), `data-fallback="data-table"`),
    html
  )
}

function dropDecorativeFontLinks(html: string): string {
  return html.replace(
    /<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']*(?:icon|display)[^"']*["'][^>]*>/gi,
    ''
  )
}

function dropNonEssentialInlineBlocks(html: string): string {
  return html
    .replace(/<script\s*>[\S\s]*?<\/script\s*>/gi, '')
    .replace(/<style\s*>[\S\s]*?<\/style\s*>/gi, '')
}

function applyLowDataTransforms(html: string, currentPath: string): string {
  return injectFooterBadge(
    downshiftIslands(dropDecorativeFontLinks(dropNonEssentialInlineBlocks(html))),
    currentPath
  )
}

const FULL_VARIANT_SENTINEL =
  '<div data-island="chart" data-eco-full-variant-sentinel="true" aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);">eco</div>'

function injectFullVariantSentinel(html: string): string {
  if (html.includes('</body>')) return html.replace('</body>', `${FULL_VARIANT_SENTINEL}</body>`)
  return `${html}${FULL_VARIANT_SENTINEL}`
}

async function handleLowDataResponse(c: Context, next: Next): Promise<void> {
  await next()

  const envValue = parseEcoLowDataDefault(
    process.env as Readonly<Record<string, string | undefined>>
  )

  const cookie = readLowDataCookie(c)
  if (envValue === 'off' && cookie === undefined) return

  const signals = collectSignals(c)
  const lowData = resolveLowDataMode(envValue, signals)

  const contentType = c.res.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('text/html')) return

  const originalHtml = await c.res.clone().text()
  const transformed = lowData
    ? applyLowDataTransforms(originalHtml, c.req.path)
    : injectFullVariantSentinel(originalHtml)

  const headers = new Headers(c.res.headers)
  headers.delete('content-length')
  c.res = new Response(transformed, {
    status: c.res.status,
    headers,
  })
}

export const lowDataModeMiddleware = (): MiddlewareHandler => handleLowDataResponse
