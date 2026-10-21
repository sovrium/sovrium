/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The string side of the rendered component kit: turning a page the engine
 * rendered into a STATIC document that opens offline, and the app's compiled
 * stylesheet into the kit's own `kit.css`.
 *
 * ─── WHY THE KIT RE-WRAPS WHAT THE RENDERER DREW ───────────────────────────
 *
 * The engine renders a page for a running server: its `<head>` links a
 * content-hashed stylesheet under `/assets/`, preloads fonts from there, and
 * its `<body>` carries the scripts that hydrate islands. None of that resolves
 * inside a directory handed to a design tool. So the kit keeps the BODY the
 * renderer drew — the markup the app really emits — keeps only what its
 * `<main>` holds (the page chrome around it is the app's, not the component's),
 * drops every script (a kit page is a picture, and islands are drawn as their
 * server-rendered shells), points the sample media at the bundle's own copies,
 * and gives it a head of its own that links `kit.css` beside it.
 *
 * ─── AND WHY `kit.css` IS NOT THE STYLESHEET VERBATIM ──────────────────────
 *
 * Three rewrites, each for something the runtime stylesheet assumes:
 *
 *  1. Its font URLs are relative to `/assets/`; the bundle keeps the fonts in
 *     `fonts/` at its root, one level above `components/`.
 *  2. A URL naming an app file the bundle does not carry is replaced by `none`
 *     rather than left to fail: the kit loads nothing it does not hold.
 *  3. The dark palette is scoped to `html.dark`, so ONE page could only ever be
 *     light or dark. The kit draws both on each page, so the dark block is
 *     widened to any `.dark` element, and the theme mappings that resolve one
 *     variable through another are re-declared there — a custom property is
 *     inherited already computed, so without that a dark section would keep
 *     the light values its root computed.
 */

/**
 * Every element a kit page does not carry: each `<script>` (a kit page is
 * static) and each island entry marker (it names a script the kit does not
 * carry). Removed by an HTML parser, so the end of an element is wherever the
 * parser ends it, however its closing tag is spelled.
 */
const NON_KIT_ELEMENTS = 'script, template[data-island-entry]'

/** The markup with every element a kit page does not carry removed. */
const withoutNonKitElements = (html: string): string =>
  new HTMLRewriter()
    .on(NON_KIT_ELEMENTS, { element: (element) => void element.remove() })
    .transform(html)

/**
 * The specimen a rendered kit page draws, and nothing of the page around it.
 *
 * The renderer wraps every page in its chrome — the "Skip to main content"
 * link, the hidden new-tab notice, the island entry markers — which belongs to
 * a page an app serves, not to a component card. The specimen is what the
 * page's `<main>` holds; a page with no `<main>` falls back to its body.
 */
export const renderedSpecimenOf = (html: string): string => {
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(body)?.[1] ?? body
  return withoutNonKitElements(main).trim()
}

/** Where the running server serves the specimens' sample media. */
const SAMPLE_MEDIA_ROUTE = '/assets/design-system/'

const SAMPLE_MEDIA_PATTERN = /\/assets\/design-system\/([A-Za-z0-9._-]+)/g

/** The sample media files a specimen draws, by basename, each once. */
export const sampleMediaNamesOf = (html: string): readonly string[] => [
  ...new Set([...html.matchAll(SAMPLE_MEDIA_PATTERN)].map((match) => match[1] ?? '')),
]

/**
 * A specimen with its sample media pointed at the bundle's own copies, by a
 * path relative to where the markup is written (`../assets/` from
 * `components/`), so the page opens offline.
 */
export const withSampleMediaAt = (html: string, directory: string): string =>
  html.replaceAll(SAMPLE_MEDIA_ROUTE, directory)

/**
 * A specimen with its sample media left out: every `src` naming the server's
 * sample media route is dropped, so the element keeps its box and its card,
 * and points at no file. For a copy published without the media.
 */
export const withoutSampleMedia = (html: string): string =>
  html.replace(/\s+src\s*=\s*(["'])\/assets\/design-system\/[A-Za-z0-9._-]+\1/g, '')

/** Escape text for an HTML text node or a double-quoted attribute. */
export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

/** One static kit document: its own head linking `kit.css` (or `stylesheet`), around a body. */
export const kitDocument = (title: string, body: string, stylesheet = 'kit.css'): string =>
  [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="stylesheet" href="${escapeHtml(stylesheet)}">`,
    '</head>',
    '<body class="bg-background text-foreground">',
    body,
    '</body>',
    '</html>',
    '',
  ].join('\n')

/** The `data-slot` names a rendered body carries, in document order, each once. */
export const slotsOf = (body: string): readonly string[] => [
  ...new Set([...body.matchAll(/\bdata-slot="([^"]+)"/g)].map((match) => match[1] ?? '')),
]

/** Where the bundle keeps the fonts, relative to `components/kit.css`. */
const FONT_DIRECTORY = '../fonts/'

/** One `url(…)` target, rewritten for the kit's place in the bundle. */
const rewrittenUrl = (target: string, quote: string): string => {
  if (target.startsWith('data:') || target.startsWith('#')) return `url(${quote}${target}${quote})`
  if (target.startsWith('fonts/')) return `url('${FONT_DIRECTORY}${target.slice('fonts/'.length)}')`
  return 'none'
}

const URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g

/** The runtime's dark selector, and the one the kit widens it to. */
const RUNTIME_DARK_SELECTOR = "html:is(.dark, [data-theme='dark'])"
const KIT_DARK_SELECTOR = ":is(html.dark, html[data-theme='dark'], .dark)"

/** Every theme mapping that resolves one variable through another (`--color-x: var(--x)`). */
const indirectThemeMappings = (css: string): readonly string[] => [
  ...new Map(
    [...css.matchAll(/(--color-[\w-]+)\s*:\s*(var\([^;{}]+\))\s*;/g)].map(
      (match) => [match[1] ?? '', `  ${match[1]}: ${match[2]};`] as const
    )
  ).values(),
]

/**
 * `components/kit.css`: the app's compiled stylesheet, rewritten to stand on
 * its own inside the bundle (see the module docblock for the three rewrites).
 */
export const kitStylesheetOf = (compiled: string): string => {
  const located = compiled
    .replaceAll(URL_PATTERN, (_match, double?: string, single?: string, bare?: string) =>
      rewrittenUrl(double ?? single ?? bare ?? '', double === undefined ? "'" : '"')
    )
    .replaceAll(RUNTIME_DARK_SELECTOR, KIT_DARK_SELECTOR)
  return [
    located.trimEnd(),
    '',
    '/* The kit draws light and dark on one page: re-resolve the theme inside each `.dark`. */',
    '.dark {',
    '  color-scheme: dark;',
    ...indirectThemeMappings(compiled),
    '}',
    '',
  ].join('\n')
}
