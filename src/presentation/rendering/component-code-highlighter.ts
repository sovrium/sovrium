/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { highlightCodeToHtml } from '@/infrastructure/markdown/shiki-highlighter'

const PLACEHOLDER_RE = /<pre\b[^>]*\bdata-code-block="([^"]*)"[^>]*>[\s\S]*?<\/pre>/g

const LANG_RE = /\bdata-code-lang="([^"]*)"/

const decodeBase64 = (value: string): string => Buffer.from(value, 'base64').toString('utf-8')

const OPEN_TAG_RE = /^<pre\b[^>]*>/
const TESTID_RE = /\bdata-testid="([^"]*)"/
const ID_RE = /\sid="([^"]*)"/

const extractPassThroughAttrs = (placeholder: string): string => {
  const openTag = OPEN_TAG_RE.exec(placeholder)?.[0] ?? ''
  const id = ID_RE.exec(openTag)?.[1]
  const testid = TESTID_RE.exec(openTag)?.[1]
  const attrs = [
    id !== undefined ? `id="${id}"` : undefined,
    testid !== undefined ? `data-testid="${testid}"` : undefined,
  ].filter((attr): attr is string => attr !== undefined)
  return attrs.length === 0 ? '' : ` ${attrs.join(' ')}`
}

const injectPassThroughAttrs = (fragment: string, attrs: string): string =>
  attrs.length === 0 ? fragment : fragment.replace(/<pre\b/, `<pre${attrs}`)

export const highlightComponentCodeBlocks = async (
  html: string,
  theme: string | undefined
): Promise<string> => {
  const matches = [...html.matchAll(PLACEHOLDER_RE)]
  if (matches.length === 0) return html

  const fragments = await Promise.all(
    matches.map(async (match): Promise<string> => {
      const code = decodeBase64(match[1] ?? '')
      const lang = LANG_RE.exec(match[0])?.[1] ?? ''
      const highlighted = await highlightCodeToHtml(lang, code, theme)
      return injectPassThroughAttrs(
        sanitizeRichTextHTML(highlighted),
        extractPassThroughAttrs(match[0])
      )
    })
  )

  let index = 0
  return html.replace(PLACEHOLDER_RE, () => fragments[index++] ?? '')
}
