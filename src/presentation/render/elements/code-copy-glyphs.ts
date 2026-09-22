/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The code-block copy affordance's GEOMETRY and markup contract, defined ONCE
 * for the two surfaces that render it: the config `code` component (React SSR —
 * see the sibling `code-copy-controls.tsx`) and the docs markdown fence (a
 * raw-HTML splice that runs after the canonical sanitiser and therefore cannot
 * render React).
 *
 * ## Why one module rather than two renderers
 *
 * A docs fence and a config `code` block are the same artifact to a reader. They
 * were previously built by two unrelated implementations — a server-rendered
 * text button on one side, a client-injected one on the other — and drifted in
 * markup, in styling, and in what a screen-reader user heard. Keeping the glyph
 * geometry and the button's attribute contract in a single module is what stops
 * that happening again.
 *
 * ## One `<svg>`, two `<g>` glyphs
 *
 * Both states ship in the SSR markup inside a SINGLE `<svg>` — the button holds
 * exactly one icon element, and the copy→check swap is a CSS `display` flip on
 * the inner `<g>`s driven by `data-copied` on the button (written by the
 * delegated `copyCodeScript`, read by the rules in
 * `code-block-styles-generator.ts`). Two sibling `<svg>`s would work visually but
 * make "the button has one icon" untestable, and a JS-built icon would leave a
 * scripts-blocked reader with an empty control.
 *
 * ## Accessibility contract
 *
 * `aria-label` carries the WHOLE accessible name and is never mutated — swapping
 * it mid-interaction makes the control vanish from under a screen-reader user
 * and reappear as a different, unrelated button. The confirmation is announced
 * through a sibling `role="status" aria-live="polite"` region instead, and
 * `title` restores the tooltip a sighted mouse user loses once the word "Copy"
 * stops being painted.
 */

/** Two overlapping sheets — the conventional "copy to clipboard" mark. */
export const COPY_SHEET_RECT = { x: '9', y: '9', width: '11', height: '11', rx: '2' } as const
export const COPY_SHEET_PATH = 'M5 15V5a2 2 0 0 1 2-2h8'

/** A check mark — the conventional "done" confirmation. */
export const CHECK_PATH = 'm5 12 5 5L20 6'

/** Shared `<svg>` presentation. Sized in fixed px so the header row never reflows. */
export const GLYPH_SVG_ATTRS = {
  width: '14',
  height: '14',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  // 1.5, the one stroke weight in the product. It was 2 — lucide's own default,
  // which nothing else here uses since the icon renderers were moved off it.
  strokeWidth: '1.5',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** Utility classes for the button itself — icon-only, right-aligned in its header. */
export const CODE_COPY_BUTTON_CLASSES =
  'ml-auto inline-flex cursor-pointer items-center justify-center rounded p-1'

/** Utility classes for the announcement region: announced, never painted. */
export const CODE_COPY_STATUS_CLASSES = 'sr-only'

/**
 * The glyph pair as raw HTML, for the docs fence splice. Built from the same
 * geometry constants the React element uses, so the two surfaces cannot render
 * different icons.
 */
const CODE_COPY_GLYPHS_HTML = `<svg width="${GLYPH_SVG_ATTRS.width}" height="${GLYPH_SVG_ATTRS.height}" viewBox="${GLYPH_SVG_ATTRS.viewBox}" fill="${GLYPH_SVG_ATTRS.fill}" stroke="${GLYPH_SVG_ATTRS.stroke}" stroke-width="${GLYPH_SVG_ATTRS.strokeWidth}" stroke-linecap="${GLYPH_SVG_ATTRS.strokeLinecap}" stroke-linejoin="${GLYPH_SVG_ATTRS.strokeLinejoin}" aria-hidden="true"><g data-copy-glyph="copy"><rect x="${COPY_SHEET_RECT.x}" y="${COPY_SHEET_RECT.y}" width="${COPY_SHEET_RECT.width}" height="${COPY_SHEET_RECT.height}" rx="${COPY_SHEET_RECT.rx}"/><path d="${COPY_SHEET_PATH}"/></g><g data-copy-glyph="copied"><path d="${CHECK_PATH}"/></g></svg>`

/** Escape a label for safe interpolation into an HTML attribute value. */
const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * The copy button + its live region as raw HTML (docs fence splice path).
 * Attribute-for-attribute identical to the React `CodeCopyButton` /
 * `CodeCopyStatus` in `code-copy-controls.tsx`.
 */
export const renderCodeCopyControlHtml = (copyLabel: string, copiedLabel: string): string =>
  `<button type="button" aria-label="${escapeAttr(copyLabel)}" title="${escapeAttr(
    copyLabel
  )}" data-copy-code="true" data-copied-label="${escapeAttr(
    copiedLabel
  )}" class="${CODE_COPY_BUTTON_CLASSES}">${CODE_COPY_GLYPHS_HTML}</button><span role="status" aria-live="polite" data-copy-status="true" class="${CODE_COPY_STATUS_CLASSES}"></span>`
