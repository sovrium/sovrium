/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The document an anonymous share reader is served at
 * `GET /s/design-system/{token}` — [internal ref] amendment A3 Part 2, surface 6.
 *
 * ─── ONE PROJECTION, RE-SERIALISED — NOT A SECOND GENERATOR ─────────────────
 *
 * The content is `renderDesignSystemMarkdown(buildDesignSystem(app))`: byte for
 * byte the document `GET /api/admin/design-system.md` already serves, run
 * through the platform's own markdown renderer. A3 requires exactly this — "the
 * share reader reuses the A2 projection; it does not grow its own" — because a
 * second serializer for the anonymous path would be a second place to leak,
 * unguarded by the `.strict()` contract that refuses a smuggled field.
 *
 * It follows that the confidentiality bound is inherited rather than
 * re-implemented: `buildDesignSystem` reads `design.*` and `theme.*` and
 * resolves no `app.env[]` value and no table row, so there is no code path here
 * on which a secret could arrive to be redacted.
 *
 * ─── A SELF-CONTAINED DOCUMENT, DELIBERATELY ────────────────────────────────
 *
 * No stylesheet request, no script, no island, no form. The reader is a
 * stranger on someone else's link: the fewer moving parts between them and the
 * text, the fewer ways this surface can acquire behaviour it is not authorised
 * to have. A3's bound — "no comment, no annotation, no feedback control, no
 * upload, and no reader-supplied content of any kind" — is satisfied here by
 * there being nothing to interact with, rather than by a rule someone has to
 * keep enforcing.
 *
 * The small inline stylesheet draws its three colours from the design system
 * the page is about, so the artifact demonstrates the palette it documents.
 * Values are pattern-checked before interpolation (see {@link safeCssColor}):
 * a `<style>` block is a CSS-injection surface, and "the config is trusted" is
 * the assumption every injection bug is built on.
 *
 * ─── WHY THIS LIVES BESIDE ITS ROUTE AND NOT IN `presentation/rendering` ────
 *
 * That is where a document builder would naturally go, and the layer boundary
 * refuses it: `infrastructure-server` has no allowance to reach
 * `presentation-rendering`, which is exactly why `page-routes.ts` takes
 * `renderPage` as an INJECTED port rather than importing it. A port is the
 * right answer for the page renderer, which has many callers and a real
 * interface; it would be ceremony for one function with one caller. So the
 * builder sits next to the only route that uses it, where the imports it needs
 * — the markdown engine, the canonical sanitiser, nothing else — are all
 * legitimately in reach.
 */

import { escapeHtml } from '@/domain/services/markdown/markdown-renderer'
import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { renderMarkdownToHtml } from '@/infrastructure/markdown/markdown-it-renderer'

/** The palette the document paints itself with. */
export interface ShareDocumentColors {
  readonly background?: string | undefined
  readonly foreground?: string | undefined
  readonly primary?: string | undefined
}

/**
 * A CSS colour value safe to interpolate into a `<style>` block, or the
 * fallback.
 *
 * Conservative on purpose: hex, `rgb()/rgba()/hsl()/hsla()/oklch()` and bare
 * keywords pass; anything carrying a quote, a semicolon, a brace or an angle
 * bracket does not. A theme value is operator-authored and schema-validated, so
 * this should never reject in practice — it exists so that a future schema
 * relaxation cannot turn a colour token into a stylesheet.
 */
const safeCssColor = (value: string | undefined, fallback: string): string =>
  value !== undefined &&
  /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|[a-zA-Z]+\([0-9a-zA-Z.,%/\s-]+\))$/.test(value)
    ? value
    : fallback

/** The document's own stylesheet: readable measure, the system's own palette. */
const documentStyles = (colors: ShareDocumentColors): string => {
  const background = safeCssColor(colors.background, '#ffffff')
  const foreground = safeCssColor(colors.foreground, '#18181b')
  const primary = safeCssColor(colors.primary, '#2563eb')
  return `
    :root { color-scheme: light dark }
    body {
      margin: 0;
      padding: 3rem 1.5rem 6rem;
      background: ${background};
      color: ${foreground};
      font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    main { max-width: 52rem; margin: 0 auto }
    h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 1.5rem }
    h2 { font-size: 1.25rem; margin: 2.5rem 0 0.75rem; color: ${primary} }
    h3 { font-size: 1rem; margin: 1.5rem 0 0.5rem }
    blockquote {
      margin: 0 0 2rem;
      padding: 0.75rem 1.25rem;
      border-left: 3px solid ${primary};
      opacity: 0.85;
    }
    table { border-collapse: collapse; width: 100%; margin: 0.5rem 0 1.5rem; font-size: 0.9rem }
    th, td { text-align: left; padding: 0.45rem 0.75rem; border-bottom: 1px solid currentColor }
    th { font-weight: 600; opacity: 0.7 }
    td, th { vertical-align: top }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em }
    ul { padding-left: 1.25rem }
    a { color: ${primary} }
  `
}

/**
 * Render the share document.
 *
 * @param markdown - the A2 projection, already built for this app
 * @param appName - the operator's app name, for the document title
 * @param colors - the design system's own palette
 * @returns a complete, self-contained HTML document
 */
export const renderDesignSystemShareDocument = (
  markdown: string,
  appName: string,
  colors: ShareDocumentColors = {}
): string => {
  // `renderMarkdownToHtml` already runs markdown-it with `html: false`, so raw
  // author HTML is dropped at parse time. The sanitiser is the second pass its
  // own docblock asks for — cheap, and the difference between one boundary and
  // none on the widest-audience surface in the product.
  const body = sanitizeRichTextHTML(renderMarkdownToHtml(markdown).html)
  const title = escapeHtml(`${appName} — Design System`)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>${documentStyles(colors)}</style>
</head>
<body>
<main>${body}</main>
</body>
</html>
`
}
