/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure HTML sanitization for rich-text and custom-HTML content.
 *
 * Backed by `sanitize-html`, a parser-based (htmlparser2) sanitizer. It
 * tokenises HTML with a real parser instead of regex, so the bypass classes
 * that defeat every regex stripper — nested/interleaved tags
 * (`<scr<script>ipt>`), exotic tag terminators (`</script\t\n bar>`), URL
 * scheme obfuscation, and unconsidered schemes (`data:`, `vbscript:`) — are
 * closed by construction rather than patched case-by-case.
 *
 * Two entry points:
 *  - `sanitizeRichTextHTML` — allowlist sanitiser for HTML that is rendered
 *    into the page (rich-text WYSIWYG columns rendered via
 *    `dangerouslySetInnerHTML`, and `customHTML` page components). Keeps a
 *    safe tag/attribute set; drops `<script>/<iframe>/<object>/<embed>`, all
 *    inline `on*` handlers, and any non-`http(s)`/`mailto` URL scheme.
 *  - `stripHtmlToText` — removes ALL markup, returning text content only.
 *    For inputs where HTML must never survive (the auth `name` field, the
 *    `{{stripHtml}}` template helper).
 *
 * Runs in pure JS with no DOM dependency, so it is safe to call from both
 * server (Bun/Node SSR) and client.
 *
 * This is the single canonical HTML sanitiser (security rule S2) — never add
 * a second one.
 *
 * Asserted by [internal ref] and [internal ref]-*.
 */

import sanitizeHtml from 'sanitize-html'

/**
 * Tags permitted in rendered rich-text / customHTML. Structural and
 * text-formatting elements only — every element that can host its own JS
 * context (`script`, `iframe`, `object`, `embed`, `style`) is intentionally
 * absent and therefore stripped.
 */
const ALLOWED_TAGS: readonly string[] = [
  'p',
  'br',
  'hr',
  'span',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  's',
  'u',
  'sub',
  'sup',
  'code',
  'pre',
  'blockquote',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
]

/**
 * Attributes permitted per tag — the XSS boundary for `sanitizeRichTextHTML`.
 * Deliberately minimal: `style` is excluded (CSS-injection surface) and no
 * `on*` handler is listed (event handlers are stripped by construction).
 *
 *  - `a`   — `href` (scheme-filtered via `allowedSchemes`) plus link metadata.
 *  - `img` — `src` (scheme-filtered) plus descriptive/size attributes.
 *  - `'*'` — `class`/`id` on every tag, so customHTML can be located by
 *    selector (`.custom`, `#sandbox-target`).
 */
// eslint-disable-next-line functional/prefer-immutable-types -- same library constraint as RICH_TEXT_OPTIONS below: sanitizeHtml.IOptions['allowedAttributes'] is mutable by design, and this value is assigned straight into that mutable option slot
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  '*': ['class', 'id'],
}

// eslint-disable-next-line functional/prefer-immutable-types -- sanitizeHtml.IOptions is mutable by library design (sanitize-html fills in defaults on the options object); a Readonly<> annotation would misrepresent it
const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: ALLOWED_ATTRIBUTES,
  // Only navigable, non-scripting schemes. `javascript:`, `data:` and
  // `vbscript:` are absent, so href/src carrying them are dropped.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  // These tags are dropped *together with* their text content.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
}

/**
 * `sanitize-html` renders void elements as `<img ... />` (XHTML self-close).
 * The editor and existing stored content use the bare HTML5 void form
 * (`<img ...>`), so the trailing ` />` is normalised to `>`.
 *
 * This is unambiguous: `sanitize-html` HTML-escapes `>` to `&gt;` inside
 * attribute values, so a literal ` />` in its output is only ever a
 * void-element self-close — never attribute content.
 */
function normaliseVoidElements(html: string): string {
  return html.replace(/ \/>/g, '>')
}

/**
 * Allowlist-sanitise HTML that will be rendered into the page (rich-text
 * columns, customHTML components). Strips scripts, embedding sinks, inline
 * event handlers, and dangerous URL schemes while preserving safe markup.
 */
export function sanitizeRichTextHTML(input: string): string {
  return normaliseVoidElements(sanitizeHtml(input, RICH_TEXT_OPTIONS))
}

/**
 * Strip ALL markup, returning text content only. For inputs where HTML must
 * never reach storage or output — the auth `name` field and the
 * `{{stripHtml}}` template helper.
 *
 * `sanitize-html` HTML-escapes the surviving text content (`&` → `&amp;`,
 * `<` → `&lt;`, `>` → `&gt;`). Since this function's contract is *plain
 * text*, those three entities are decoded back so callers receive literal
 * characters (e.g. `Tom & Jerry`, not `Tom &amp; Jerry`). `&amp;` is decoded
 * last so a literal `&lt;` in the input survives as `&lt;`, not `<`.
 */
export function stripHtmlToText(input: string): string {
  return sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/**
 * Convert HTML to a normalised set of plain-text lines. Shared by the
 * `file/generatePdf` and `file/extractText` automation handlers, which both
 * need to flatten an HTML template into visible text while preserving
 * block-level line breaks.
 *
 * Block-closing tags (`<br>`, `</p>`, `</h1-6>`, `</div>`, `</li>`) are turned
 * into newlines first so paragraph/heading structure survives the strip; then
 * `stripHtmlToText` performs robust, parser-based tag removal + entity decode
 * (closing the nested-tag bypass and decoding `&amp;` LAST to avoid
 * double-unescaping). Each resulting line has its intra-line whitespace
 * collapsed and trimmed, and empty lines are dropped.
 *
 * The block-tag regex is a targeted, closed set — not a general
 * `<[^>]*>` strip — so it carries no incomplete-sanitization risk: the actual
 * tag stripping is delegated entirely to the parser-based `stripHtmlToText`.
 */
export function htmlToTextLines(html: string): readonly string[] {
  return stripHtmlToText(html.replace(/<\s*(br|\/p|\/h[1-6]|\/div|\/li)\s*>/gi, '\n'))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
}
