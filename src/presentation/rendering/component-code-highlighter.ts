/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Standalone `code` COMPONENT SSR syntax-highlight pass
 * ([internal ref]..033).
 *
 * The `code` component renderer is synchronous (it runs inside `renderToString`),
 * but Shiki is async (it dynamically `import()`s grammars/themes). This mirrors
 * the markdown fence pipeline's placeholder-splice pattern
 * (`markdown-page-resolver.composeMarkdownHtml`): the sync renderer emits a
 * self-contained placeholder — `<pre … data-code-block="<base64 source>"
 * data-code-lang="<grammar>">…</pre>` (the visible `<code>` stays as an escaped
 * fallback) — and this post-render pass, running in the async page-render phase
 * where `app.theme.codeBlock.theme` is available, replaces each placeholder with
 * Shiki class-based markup.
 *
 * Boundary responsibilities (mirrors the markdown split):
 *  - `infrastructure/markdown/shiki-highlighter.highlightCodeToHtml` produces the
 *    token-coloured `<pre class="shiki <theme>">` markup (no inline `style`,
 *    `tok-XXXXXX` colour classes) — the same engine + transformer as fences.
 *  - This presentation helper composes: extract → highlight → sanitise → splice.
 *    Every highlighted fragment passes through the single canonical
 *    `sanitizeRichTextHTML` (security rule S2 — one sanitiser, `class` kept on
 *    pre/code/span, `style` dropped), so the token contract survives and no
 * inline style can leak.
 *
 * The Copy button and `.relative` wrapper are siblings of the placeholder
 * `<pre>`, so replacing only the `<pre>…</pre>` preserves them. A page with no
 * `code` components (the common case) returns unchanged after a single cheap
 * regex scan.
 */

import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { highlightCodeToHtml } from '@/infrastructure/markdown/shiki-highlighter'

/**
 * Match a `code`-component placeholder `<pre>` carrying the base64 source in
 * `data-code-block`. Non-greedy up to the first `</pre>` (the escaped fallback
 * content never contains a literal `</pre>`), and `[^>]*` around the anchor
 * attribute is safe because neither base64 nor HTML attributes contain `>`.
 */
const PLACEHOLDER_RE = /<pre\b[^>]*\bdata-code-block="([^"]*)"[^>]*>[\s\S]*?<\/pre>/g

/** Extract the grammar name from a matched placeholder's `data-code-lang`. */
const LANG_RE = /\bdata-code-lang="([^"]*)"/

const decodeBase64 = (value: string): string => Buffer.from(value, 'base64').toString('utf-8')

/**
 * Match the pass-through author attributes on the placeholder `<pre>`'s opening
 * tag that Shiki's replacement `<pre>` does not carry (Shiki emits a brand-new
 * `<pre class="shiki …">`): the author `data-testid` (which the sanitiser drops)
 * and `id`. Anchored to the opening tag (up to the first `>`) so the escaped
 * fallback body is never scanned. `data-testid` is matched with a leading `\b`
 * so `data-code-lang`/`data-code-block` never trip it; `id` is matched with a
 * leading `\s` so `data-testid`'s `…testid=` never matches as an `id=`.
 */
const OPEN_TAG_RE = /^<pre\b[^>]*>/
const TESTID_RE = /\bdata-testid="([^"]*)"/
const ID_RE = /\sid="([^"]*)"/

/**
 * Extract the trusted pass-through attributes (`id`, `data-testid`) from a
 * placeholder `<pre>`'s opening tag, returned as a ready-to-splice ` k="v"`
 * string (leading space, empty when neither is present). Values are captured
 * as `[^"]*`, so they cannot contain `"`; the sources are config-produced
 * (trusted), so re-emitting them verbatim introduces no injection surface.
 */
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

/**
 * Re-emit the extracted pass-through attributes onto the (already sanitised)
 * Shiki fragment's first `<pre>` opening tag. Applied AFTER `sanitizeRichTextHTML`
 * so `data-testid` (absent from the sanitiser allowlist) survives; a no-op when
 * the placeholder carried neither attribute.
 */
const injectPassThroughAttrs = (fragment: string, attrs: string): string =>
  attrs.length === 0 ? fragment : fragment.replace(/<pre\b/, `<pre${attrs}`)

/**
 * Replace every `code`-component placeholder in a rendered page's HTML with
 * Shiki-highlighted, sanitised markup. Returns the input verbatim when the page
 * has no such placeholders. `theme` is `app.theme.codeBlock.theme` (an unset
 * value defaults to `github-dark` inside the highlighter).
 */
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
      // Re-emit the placeholder's trusted `data-testid`/`id` onto the Shiki
      // `<pre>` — the async splice otherwise discards them (the sanitiser drops
      // `data-testid`; Shiki's fresh `<pre>` never carried the author anchors).
      return injectPassThroughAttrs(
        sanitizeRichTextHTML(highlighted),
        extractPassThroughAttrs(match[0])
      )
    })
  )

  // `matchAll` and `replace` walk the same regex over the same string in the
  // same left-to-right order, so the running index aligns each placeholder with
  // its pre-computed fragment.
  // eslint-disable-next-line functional/no-let -- sequential splice index paired with the sync replace callback
  let index = 0
  return html.replace(PLACEHOLDER_RE, () => fragments[index++] ?? '')
}
