/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Theme } from '@/domain/models/app/theme'
import type { MarkdownDirective } from '@/domain/services/markdown-renderer'

const PLACEHOLDER_RE = /<div class="md-directive md-directive-(\d+)">([\s\S]*?)<\/div>\s*/g

const stripOuterParagraph = (html: string): string => {
  const trimmed = html.trim()
  const match = /^<p>([\s\S]*?)<\/p>$/.exec(trimmed)
  if (match === null) return trimmed
  return match[1] ?? trimmed
}

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const themeColor = (theme: Theme | undefined, key: string): string | undefined => {
  const colors = theme?.colors as Record<string, unknown> | undefined
  const value = colors?.[key]
  return typeof value === 'string' ? value : undefined
}

const renderCallout = (innerHtml: string, theme: Theme | undefined): string => {
  const infoColor = themeColor(theme, 'info')
  const styleAttr = infoColor !== undefined ? ` style="border-color:${escapeAttr(infoColor)}"` : ''
  return `<div role="alert" data-component="alert" class="md-callout alert info"${styleAttr}>${innerHtml}</div>`
}

const renderCodeBlock = (innerHtml: string): string =>
  `<div data-component="code-block" class="md-code-block">${innerHtml.trim()}</div>`

const renderCta = (innerHtml: string): string => {
  const label = stripOuterParagraph(innerHtml)
  return `<button type="button" data-component="cta" class="md-cta">${label}</button>`
}

const renderIcon = (attrs: Readonly<Record<string, string>>, _innerHtml: string): string => {
  const name = attrs['name'] ?? ''
  const nameAttr = name.length > 0 ? ` data-icon-name="${escapeAttr(name)}"` : ''
  return `<svg data-component="icon" class="md-icon"${nameAttr} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"></svg>`
}

const resolveDirectiveHtml = (
  directive: MarkdownDirective,
  innerHtml: string,
  theme: Theme | undefined
): string => {
  switch (directive.name) {
    case 'callout':
      return renderCallout(innerHtml, theme)
    case 'code-block':
      return renderCodeBlock(innerHtml)
    case 'cta':
      return renderCta(innerHtml)
    case 'icon':
      return renderIcon(directive.attrs, innerHtml)
    default:
      return innerHtml
  }
}

export const spliceMarkdownDirectives = (
  html: string,
  directives: readonly MarkdownDirective[],
  theme: Theme | undefined
): string => {
  if (directives.length === 0) return html
  return html.replace(PLACEHOLDER_RE, (_match, indexStr: string, innerHtml: string) => {
    const index = Number(indexStr)
    const directive = directives[index]
    if (directive === undefined) return innerHtml
    return resolveDirectiveHtml(directive, innerHtml, theme)
  })
}
