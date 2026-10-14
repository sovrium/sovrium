/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The house spinner mark as DATA: one source for every place that draws it.
 *
 * Three consumers draw the same `<svg>`, and two of them cannot run React:
 *
 * - `renderSpinnerMark()` (`./spinner-mark.tsx`) — the server-rendered loading
 *   button and the `spinner` component type, plus the React islands that show a
 *   pending state (CRUD save and delete, the record button field);
 * - `beginPending()` (`islands/runtime/pending-control.ts`) — the plain-DOM
 *   runtimes (action buttons, endpoint forms, row actions) that build the mark
 *   with `createElementNS` while a request is in flight;
 * - the hosted-form runtime, a string of JavaScript inlined into the page, which
 *   receives {@link SPINNER_MARK} serialised as JSON.
 *
 * Kept free of React on purpose: the plain-script client runtime imports this
 * module, and a React import here would drag the library into a chunk that has
 * never needed it.
 *
 * ─── THE MARK ───────────────────────────────────────────────────────────────
 *
 * One open arc, drawn once — not the stock two-part spinner (a 4px ring at 25%
 * opacity with a filled quarter-wedge riding over it), which reads as a solid
 * disc at 16px. 2.5 is the one stroke weight in the product that is not 1.5,
 * deliberately: a spinner is read as MOTION rather than as a glyph, and at icon
 * weight the arc disappears while it turns.
 *
 * `motion-reduce:animate-none` stops the turn for a reader who asked the system
 * for less motion (WCAG 2.3.3). The arc still stands where it stopped, and every
 * pending control carries a pending WORD beside it, so nothing is lost: the word
 * says what the motion only suggested.
 *
 * `width` / `height` are the intrinsic 16px floor, not the size: presentation
 * attributes lose to any CSS rule, which is how the `spinner` component scales
 * the same mark with `size-full`.
 */

/** The classes every spinner mark carries, before a caller's own. */
export const SPINNER_MARK_CLASS = 'animate-spin motion-reduce:animate-none'

/** The arc's path data. */
export const SPINNER_MARK_PATH = 'M12 3a9 9 0 1 1-6.4 2.6'

/** The SVG namespace the DOM builders create the mark in. */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * The `<svg>` attributes, in DOM spelling and in the order the server emits
 * them, `class` first. `data-loading` is the marker a spec reads to find the
 * mark inside a control; `aria-hidden` keeps it out of the accessible name,
 * which the pending word carries.
 */
export const SPINNER_MARK_ATTRIBUTES: Readonly<Record<string, string>> = {
  class: SPINNER_MARK_CLASS,
  'data-loading': 'true',
  xmlns: SVG_NAMESPACE,
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2.5',
  'stroke-linecap': 'round',
  viewBox: '0 0 24 24',
  width: '16',
  height: '16',
  'aria-hidden': 'true',
}

/** Everything a DOM builder needs, as one JSON-serialisable value. */
export interface SpinnerMarkSpec {
  readonly attributes: Readonly<Record<string, string>>
  readonly path: string
  readonly namespace: string
}

/** The mark as one value, for a builder that cannot import (the inlined form runtime). */
export const SPINNER_MARK: SpinnerMarkSpec = {
  attributes: SPINNER_MARK_ATTRIBUTES,
  path: SPINNER_MARK_PATH,
  namespace: SVG_NAMESPACE,
}

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * The mark as an HTML string, byte-equal to what `renderSpinnerMark()` renders
 * with no extra class. The unit test holds the two together.
 */
export function spinnerMarkMarkup(): string {
  const attributes = Object.entries(SPINNER_MARK_ATTRIBUTES)
    .map(([name, value]) => `${name}="${escapeAttribute(value)}"`)
    .join(' ')
  return `<svg ${attributes}><path d="${SPINNER_MARK_PATH}"></path></svg>`
}
