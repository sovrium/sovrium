/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { logDebug, logWarning } from '@/infrastructure/logging/logger'

const DEFAULT_THEME = 'github-dark'

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const HIGHLIGHTER_CACHE = new Map<string, Promise<ShikiCodeToHtml>>()

type ShikiCodeToHtml = (code: string, options: ShikiOptions) => Promise<string>

interface ShikiOptions {
  readonly lang: string
  readonly theme: string
  readonly transformers?: readonly ShikiTransformerLike[]
}

interface ShikiTransformerLike {
  readonly name?: string
  readonly pre?: (this: ShikiContextLike, hast: HastElement) => HastElement | void
  readonly span?: (this: ShikiContextLike, hast: HastElement) => HastElement | void
}

interface ShikiContextLike {
  readonly addClassToHast: (hast: HastElement, className: string) => HastElement
}

interface HastElement {
  readonly type: 'element'
  readonly tagName: string
  properties?: Record<string, unknown>
}

const getShikiForTheme = (theme: string): Promise<ShikiCodeToHtml> => {
  const cached = HIGHLIGHTER_CACHE.get(theme)
  if (cached !== undefined) return cached
  const building = (async () => {
    logDebug(`[shiki] Initialising highlighter (theme=${theme})`)
    const shiki = (await import('shiki')) as { codeToHtml: ShikiCodeToHtml }
    return shiki.codeToHtml
  })()
  HIGHLIGHTER_CACHE.set(theme, building)
  return building
}

const COLOR_RE = /color\s*:\s*#([0-9a-fA-F]{3,8})/
const styleToColorClass = (style: string): string | undefined => {
  const match = COLOR_RE.exec(style)
  if (match === null) return undefined
  const hex = match[1]
  if (hex === undefined) return undefined
  return `tok-${hex.toUpperCase()}`
}

const CLASS_BASED_TRANSFORMER: ShikiTransformerLike = {
  name: 'sovrium-class-based',
  pre(hast) {
    if (hast.properties !== undefined) {
      delete hast.properties.style
    }
  },
  span(hast) {
    const style = (hast.properties?.style as string | undefined) ?? ''
    const colorClass = styleToColorClass(style)
    if (colorClass !== undefined) {
      this.addClassToHast(hast, colorClass)
    }
    if (hast.properties !== undefined && 'style' in hast.properties) {
      delete hast.properties.style
    }
  },
}

const highlightOne = async (
  codeToHtml: ShikiCodeToHtml,
  lang: string,
  code: string,
  theme: string
): Promise<string> => {
  if (lang.length === 0) {
    return `<pre><code>${escapeHtml(code)}</code></pre>`
  }
  try {
    return await codeToHtml(code, {
      lang,
      theme,
      transformers: [CLASS_BASED_TRANSFORMER],
    })
  } catch (error) {
    logWarning(
      `[shiki] Failed to highlight ${lang} block (theme=${theme}); falling back to plain pre/code: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`
  }
}

const PLACEHOLDER_RE =
  /<pre><code(?:\s+class="[^"]*")?\s+data-md-code="(\d+)">[\s\S]*?<\/code><\/pre>/g

export const highlightCodeBlocks = async (
  html: string,
  codeBlocks: readonly { readonly lang: string; readonly code: string }[],
  theme: string | undefined
): Promise<string> => {
  if (codeBlocks.length === 0) return html
  const activeTheme = theme && theme.length > 0 ? theme : DEFAULT_THEME
  const codeToHtml = await getShikiForTheme(activeTheme)

  const highlighted = await Promise.all(
    codeBlocks.map(({ lang, code }) => highlightOne(codeToHtml, lang, code, activeTheme))
  )

  return html.replace(PLACEHOLDER_RE, (_match, idxStr: string) => {
    const idx = Number(idxStr)
    return highlighted[idx] ?? _match
  })
}
