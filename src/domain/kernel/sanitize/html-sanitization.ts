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
 * Asserted by a pages CRUD wysiwyg spec and [internal ref]-*.
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

// ─── Email profile ─────────────────────────────────────────────────────────

/** One CSS length or keyword token: `0`, `24px`, `1.5em`, `100%`, `auto` — never negative. */
const LENGTH = String.raw`(?:0|\d+(?:\.\d+)?(?:px|em|rem|%|pt)?|auto)`
/** One to four lengths, as `padding` and `margin` take them. */
const LENGTHS = new RegExp(String.raw`^${LENGTH}(?:\s+${LENGTH}){0,3}$`, 'i')
const ONE_LENGTH = new RegExp(String.raw`^(?:${LENGTH}|normal)$`, 'i')
/** A colour: a hex value, a named colour, or `rgb()`/`rgba()`/`hsl()`/`hsla()` of plain numbers. */
const COLOR = String.raw`(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\(\s*[\d.\s,%]+\)|hsla?\(\s*[\d.\s,%deg]+\))`
const COLOR_VALUE = new RegExp(String.raw`^${COLOR}$`, 'i')
/** A border shorthand or side: width, style and colour tokens, nothing that calls a function. */
const BORDER = new RegExp(
  String.raw`^(?:none|0|(?:(?:${LENGTH}|thin|medium|thick)\s+)?(?:none|solid|dotted|dashed|double)(?:\s+${COLOR})?)$`,
  'i'
)
// eslint-disable-next-line functional/prefer-immutable-types -- a RegExp is what sanitize-html's allowedStyles slot takes
const keyword = (...words: readonly string[]): RegExp => new RegExp(`^(?:${words.join('|')})$`, 'i')

/**
 * The inline CSS an email template may keep: the layout properties email
 * clients honour, each with an anchored value pattern. Nothing that loads a
 * resource (`url()`), computes (`expression`, `var()`, `calc()`), positions
 * outside the flow (`position`, `z-index`, `transform`) or hides text.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- assigned straight into sanitize-html's mutable `allowedStyles` option slot
const EMAIL_STYLES: Record<string, RegExp[]> = {
  color: [COLOR_VALUE],
  'background-color': [COLOR_VALUE],
  'font-family': [/^[a-z0-9 ,'"-]+$/i],
  'font-size': [ONE_LENGTH],
  'font-weight': [keyword('normal', 'bold', 'bolder', 'lighter', '[1-9]00')],
  'font-style': [keyword('normal', 'italic', 'oblique')],
  'line-height': [ONE_LENGTH],
  'letter-spacing': [ONE_LENGTH],
  'text-align': [keyword('left', 'right', 'center', 'justify', 'start', 'end')],
  'text-decoration': [keyword('none', 'underline', 'line-through', 'overline')],
  'text-transform': [keyword('none', 'uppercase', 'lowercase', 'capitalize')],
  'vertical-align': [keyword('top', 'middle', 'bottom', 'baseline', 'text-top', 'text-bottom')],
  'white-space': [keyword('normal', 'nowrap', 'pre', 'pre-wrap', 'pre-line')],
  ...Object.fromEntries(
    ['padding', 'margin'].flatMap((side) => [
      [side, [LENGTHS]],
      ...['top', 'right', 'bottom', 'left'].map((edge) => [`${side}-${edge}`, [ONE_LENGTH]]),
    ])
  ),
  ...Object.fromEntries(
    ['border', 'border-top', 'border-right', 'border-bottom', 'border-left'].map((p) => [
      p,
      [BORDER],
    ])
  ),
  'border-radius': [LENGTHS],
  'border-collapse': [keyword('collapse', 'separate')],
  'border-spacing': [LENGTHS],
  width: [ONE_LENGTH],
  'min-width': [ONE_LENGTH],
  'max-width': [ONE_LENGTH],
  height: [ONE_LENGTH],
  display: [keyword('block', 'inline', 'inline-block', 'table', 'table-row', 'table-cell', 'none')],
  'mso-line-height-rule': [keyword('exactly', 'at-least')],
  'mso-table-lspace': [ONE_LENGTH],
  'mso-table-rspace': [ONE_LENGTH],
}

/** The table-layout attributes email clients still read. */
const LAYOUT_ATTRIBUTES: readonly string[] = ['align', 'valign', 'bgcolor', 'width', 'height']

// eslint-disable-next-line functional/prefer-immutable-types -- sanitize-html options are mutable by library design (see RICH_TEXT_OPTIONS)
const EMAIL_OPTIONS: sanitizeHtml.IOptions = {
  ...RICH_TEXT_OPTIONS,
  // The sectioning elements a letterhead or a layout partial frames a message
  // with are structure only: no attribute beyond the global ones below.
  allowedTags: [
    ...ALLOWED_TAGS,
    'center',
    'small',
    'tfoot',
    'caption',
    'colgroup',
    'col',
    'header',
    'footer',
    'main',
    'section',
    'article',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel', 'style'],
    img: ['src', 'alt', 'title', 'width', 'height', 'border', 'style'],
    table: ['role', 'border', 'cellpadding', 'cellspacing', ...LAYOUT_ATTRIBUTES],
    td: ['colspan', 'rowspan', ...LAYOUT_ATTRIBUTES],
    th: ['colspan', 'rowspan', 'scope', ...LAYOUT_ATTRIBUTES],
    tr: [...LAYOUT_ATTRIBUTES],
    col: ['span', 'width'],
    '*': ['class', 'id', 'style', 'dir', 'lang', 'role', 'align'],
  },
  allowedStyles: { '*': EMAIL_STYLES },
  // Images over https or as an inline attachment (`cid:`), never `http:` or `data:`.
  allowedSchemesByTag: { img: ['https', 'cid'] },
  // A quote in text stays escaped as the template escaped it, so markup from
  // data reads as text in the source too (`&lt;a href=&quot;…`), not only on screen.
  textFilter: (text) => text.replace(/"/g, '&quot;'),
  // A link leaves the message without handing the opener a reference to it.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer' },
    }),
  },
}

/**
 * Which allowlist a sanitize runs: `rich-text` (rendered page content and any
 * HTML a third party may have written — no `style`), or `email` (a message
 * body the operator authored — inline `style` and the table-layout attributes
 * email clients need, each style value checked against an allowlist). A
 * `<style>` element is never kept, in either profile.
 */
export type SanitizeProfile = 'rich-text' | 'email'

/**
 * Allowlist-sanitise HTML that will be rendered into the page (rich-text
 * columns, customHTML components) or sent as an email body. Strips scripts,
 * embedding sinks, inline event handlers, and dangerous URL schemes while
 * preserving safe markup; see {@link SanitizeProfile} for what each keeps.
 */
export function sanitizeRichTextHTML(
  input: string,
  options: { readonly profile?: SanitizeProfile } = {}
): string {
  const profile = options.profile === 'email' ? EMAIL_OPTIONS : RICH_TEXT_OPTIONS
  return normaliseVoidElements(sanitizeHtml(input, profile))
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
 * Convert HTML to a normalised set of plain-text lines, for the
 * `file/extractText` automation handler, which flattens an HTML file into
 * visible text while preserving block-level line breaks.
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
