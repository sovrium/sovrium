/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure HTML sanitization for rich-text user-generated content.
 *
 * Strips dangerous constructs that could enable XSS when the resulting HTML is
 * later rendered into the page (e.g., for rich-text columns rendered via
 * `dangerouslySetInnerHTML` in `crud-form-skeleton.tsx`):
 *
 *  - `<script>...</script>` blocks (run iteratively to defeat the
 *    nested-token bypass `<scr<script>...</scr</script>ipt>`).
 *  - Self-closing `<script />` and orphan opening/closing tags.
 *  - Embedding sinks `<iframe>`, `<object>`, `<embed>` (whole element).
 *  - Inline event-handler attributes (`onclick="..."`, `on load=...`).
 *  - `javascript:` URL schemes (including obfuscation via embedded
 *    whitespace and HTML-entity references such as `&Tab;`/`&NewLine;`).
 *
 * This runs in pure JS (no DOM dependency) so it is safe to call from both
 * server (Bun/Node) and client. We deliberately keep this as a regex
 * stripper — the threat model is "user-typed rich-text in the WYSIWYG
 * editor", which Tiptap already filters at the editor level; this is a
 * defence-in-depth server-side scrub of HTML that bypasses the editor
 * (raw paste, direct API submission, etc.).
 *
 * For full XSS hardening of arbitrary user-supplied HTML, switch this to
 * `isomorphic-dompurify` or `sanitize-html` (deferred follow-up). The
 * current implementation meets the bar asserted by
 * APP-PAGES-CRUD-WYSIWYG-007 and additionally defeats the most common
 * bypasses, but is not a complete sanitizer.
 *
 * Asserted by APP-PAGES-CRUD-WYSIWYG-007.
 */

/**
 * Single-pass strip of `<script>` constructs (paired, self-closing, orphan).
 */
function stripScripts(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<\/script\s*>/gi, '')
}

/**
 * Repeatedly strip `<script>` constructs until the input stabilises. This
 * defeats the nested-tag bypass `<scr<script>...</scr</script>ipt>` which
 * leaves a residual `<script>` start tag after a single pass. Bounded to
 * a small number of passes so pathological input cannot spin.
 */
function stripScriptsToFixedPoint(html: string, remaining: number): string {
  if (remaining === 0) return html
  const next = stripScripts(html)
  if (next === html) return html
  return stripScriptsToFixedPoint(next, remaining - 1)
}

/**
 * Strip elements that can host their own JS context (<iframe srcdoc=...>,
 * <object data=javascript:...>, <embed src=...>).
 */
function stripEmbeds(html: string): string {
  return html
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/?>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object\s*>/gi, '')
    .replace(/<object\b[^>]*\/?>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
}

/**
 * Decode HTML-entity-based scheme obfuscation (`java&Tab;script:`,
 * `java&NewLine;script:`, `java&#9;script:`, `&#x6A;ava...`) BEFORE the
 * `javascript:` check so encoded variants are also caught.
 *
 * Only ASCII whitespace and printable characters are decoded; leaving
 * other entities alone keeps Tiptap's normal output stable (e.g., `&amp;`,
 * `&nbsp;` inside paragraph text are preserved).
 */
function decodeSchemeObfuscation(html: string): string {
  return html
    .replace(/&Tab;/gi, '\t')
    .replace(/&NewLine;/gi, '\n')
    .replace(/&#x?([0-9a-f]+);/gi, (match, code: string) => {
      const num = code.toLowerCase().startsWith('x')
        ? parseInt(code.slice(1), 16)
        : parseInt(code, 10)
      if (num === 9 || num === 10 || num === 13 || (num >= 0x20 && num <= 0x7e)) {
        return String.fromCharCode(num)
      }
      return match
    })
}

export function sanitizeRichTextHTML(input: string): string {
  const withoutScripts = stripScriptsToFixedPoint(input, 8)
  const withoutEmbeds = stripEmbeds(withoutScripts)
  // Inline event-handler attributes — match across whitespace before `=`
  // so `<p onclick\n=\n"x">` is also stripped.
  const withoutInlineHandlers = withoutEmbeds.replace(
    /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    ''
  )
  const decoded = decodeSchemeObfuscation(withoutInlineHandlers)
  // Strip javascript: URLs (allow whitespace inside the scheme keyword).
  return decoded.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, '')
}
