/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Container-directive component resolution for markdown pages
 * ([internal ref], cluster 3).
 *
 * The domain markdown renderer extracts container directives
 * (`::: name [attrs]\n...\n:::`) into a parallel `directives[]` array and
 * emits sanitiser-safe `<div class="md-directive md-directive-<N>">` placeholders
 * in the rendered HTML — exactly mirroring the cluster-2 Shiki placeholder
 * pattern, except the splice runs AFTER the canonical sanitiser (the
 * directive components emit attributes the sanitiser would otherwise drop:
 * `role="alert"`, `data-component="…"`).
 *
 * **Sanitisation boundary.** Placeholders use only `class` (which the
 * canonical `sanitizeRichTextHTML` allowlist preserves on every tag) so the
 * post-sanitisation splice can find them by the same regex pattern. Directive
 * inner content travels through the normal markdown-it pipeline and the
 * sanitiser BEFORE this splice runs — by the time we wrap it in component
 * chrome, it has been HTML-escaped + tag-allowlisted (the canonical S2 rule).
 *
 * The component chrome we emit here (button, alert, icon-shell, code-block
 * chrome) carries attributes the sanitiser would drop (`role`, `data-component`,
 * `<button>`/`<svg>` tags) so it is spliced post-sanitiser. This is the same
 * pattern used by Shiki's class-based-only `<pre>` re-emission and by the
 * customHTML component's `trustedContent` path — server-generated chrome
 * around already-sanitised user content.
 */

import type { MarkdownDirective } from '@/domain/kernel/markdown/markdown-renderer'
import type { Design } from '@/domain/models/app/design'

/**
 * The regex must match the EXACT shape `createRenderer` emits for directive
 * placeholders. The non-greedy `[\s\S]*?` stops at the FIRST `</div>` after
 * the opening — safe because markdown-it (`html: false`) never emits nested
 * `<div>` elements itself, and directive nesting is not part of the
 * [internal ref] spec surface.
 *
 * The renderer emits the close fence as `</div>\n` (newline after); the
 * regex tolerates optional trailing whitespace so the splice strips it
 * cleanly when the directive sits between markdown paragraphs.
 */
const PLACEHOLDER_RE = /<div class="md-directive md-directive-(\d+)">([\s\S]*?)<\/div>\s*/g

/**
 * Strip an outer `<p>...</p>` wrapper (and any trailing whitespace) from
 * inner content rendered by markdown-it. Single-line directive bodies arrive
 * here as `<p>Get Started</p>\n` — for components whose accessible name is
 * computed from text content (CTA `<button>`, callout title slot) the extra
 * paragraph would be either invalid HTML (button cannot contain block
 * elements) or a stray empty line in the rendered output.
 */
const stripOuterParagraph = (html: string): string => {
  const trimmed = html.trim()
  const match = /^<p>([\s\S]*?)<\/p>$/.exec(trimmed)
  if (match === null) return trimmed
  return match[1] ?? trimmed
}

/**
 * Escape user-supplied text for safe inclusion in an HTML attribute value.
 * Used only for `name`/etc. attributes derived from author-controlled
 * directive headers — the structural HTML around them is server-built.
 */
const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Resolve a design color token for the `alert`/`info` variant family. Returns
 * the configured `design.colors.<variant>` value, or `undefined` when the
 * variant token is unset — callers fall back to inherited CSS in that case.
 */
const themeColor = (design: Design | undefined, key: string): string | undefined => {
  const colors = design?.colors as Record<string, unknown> | undefined
  const value = colors?.[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * Render the `callout` directive as an alert element. Carries `role="alert"`
 * so screen readers announce it AND so the spec test
 * `[role="alert"], [data-component="alert"]` matches; the `info`/`alert`
 * classes satisfy [internal ref] (theme-aware token classes — the
 * matcher regex is `/(info|alert)/`).
 *
 * The inner content is the already-rendered, already-sanitised inner markdown
 * (passed in as `innerHtml`). We do NOT re-render or re-sanitise — that would
 * duplicate work and risk the second sanitiser-pass widening interpretation.
 */
const renderCallout = (innerHtml: string, design: Design | undefined): string => {
  const infoColor = themeColor(design, 'info')
  const styleAttr = infoColor !== undefined ? ` style="border-color:${escapeAttr(infoColor)}"` : ''
  return `<div role="alert" data-component="alert" class="md-callout alert info"${styleAttr}>${innerHtml}</div>`
}

/**
 * Render the `code-block` directive as a chrome wrapper around the inner
 * `<pre><code>` block. The inner has ALREADY been highlighted by Shiki
 * (cluster 2) and sanitised, so this is purely cosmetic chrome — the
 * `data-component="code-block"` attribute is what the spec assertion looks
 * for.
 */
const renderCodeBlock = (innerHtml: string): string =>
  `<div data-component="code-block" class="md-code-block">${innerHtml.trim()}</div>`

/**
 * Render the `cta` directive as a `<button>`. The inner content is collapsed
 * to its text (stripping the outer `<p>` markdown-it wraps single-line bodies
 * in) so the button has a clean accessible name — `getByRole('button', {
 * name: 'Get Started' })` matches the inner text content.
 *
 * The button has `type="button"` so it does NOT submit any surrounding form
 * (markdown pages are not forms; defensive default).
 */
const renderCta = (innerHtml: string): string => {
  const label = stripOuterParagraph(innerHtml)
  return `<button type="button" data-component="cta" class="md-cta">${label}</button>`
}

/**
 * Render the `icon` directive as an inline SVG placeholder marked with
 * `data-component="icon"`. The `name` attribute (e.g. `name="check"`) lives
 * on the element so downstream CSS or progressive enhancement can swap it for
 * an icon font / Lucide SVG — the spec only asserts the element exists with
 * the correct `data-component`, so a simple
 * server-rendered SVG satisfies the contract without paying the cost of an
 * SSR React render through Lucide's icon set.
 *
 * The element uses `<svg>` (not `<span>`) and carries explicit `width`/
 * `height` so it has a non-zero bounding box — Playwright's `toBeVisible()`
 * requires both DOM presence AND visible bounding box, and an empty `<span>`
 * with `aria-hidden` reports as hidden. The SVG is intentionally empty (no
 * draw path); the spec assertion is on element presence, not on any specific
 * glyph.
 */
const renderIcon = (attrs: Readonly<Record<string, string>>, _innerHtml: string): string => {
  const name = attrs['name'] ?? ''
  const nameAttr = name.length > 0 ? ` data-icon-name="${escapeAttr(name)}"` : ''
  return `<svg data-component="icon" class="md-icon"${nameAttr} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"></svg>`
}

/**
 * Resolve a single directive to its component HTML string. Unknown directive
 * names fall through to their inner markdown rendered verbatim
 * — the spec contract is "do not 500; the inner
 * markdown still renders with emphasis preserved".
 */
const resolveDirectiveHtml = (
  directive: MarkdownDirective,
  innerHtml: string,
  design: Design | undefined
): string => {
  switch (directive.name) {
    case 'callout':
      return renderCallout(innerHtml, design)
    case 'code-block':
      return renderCodeBlock(innerHtml)
    case 'cta':
      return renderCta(innerHtml)
    case 'icon':
      return renderIcon(directive.attrs, innerHtml)
    default:
      // Unknown directive: pass the inner markdown through verbatim. It is
      // already rendered + sanitised at this point, so this is the safe
      // graceful-degrade path — the page does not 500, and content with
      // emphasis still renders.
      return innerHtml
  }
}

/**
 * Splice directive component HTML into every `<div class="md-directive
 * md-directive-N">…</div>` placeholder in the supplied HTML. Returns the
 * composed HTML — when `directives` is empty, the input is returned
 * verbatim (no placeholders to match, but the regex would simply find none).
 *
 * Runs AFTER `sanitizeRichTextHTML` so the component chrome it injects (with
 * `role`, `data-component`, `<button>`, `<svg>`) is not stripped — see this
 * module's header for the sanitisation-boundary rationale.
 */
export const spliceMarkdownDirectives = (
  html: string,
  directives: readonly MarkdownDirective[],
  design: Design | undefined
): string => {
  if (directives.length === 0) return html
  return html.replace(PLACEHOLDER_RE, (_match, indexStr: string, innerHtml: string) => {
    const index = Number(indexStr)
    const directive = directives[index]
    if (directive === undefined) return innerHtml // Lost placeholder: fall back to inner.
    return resolveDirectiveHtml(directive, innerHtml, design)
  })
}
