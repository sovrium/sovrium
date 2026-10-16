/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { KeyboardEvent } from 'react'

/** What Tab can reach: the controls a keyboard user can land on. */
const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/** The panel's own tab stops, in order, left out the focus guards around it. */
const tabStopsOf = (panel: HTMLElement): readonly HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => !el.hasAttribute('data-base-ui-focus-guard') && el.getClientRects().length > 0
  )

/**
 * Keep Tab inside a modal panel (WCAG 2.4.3, RGAA 7.3 and 12.8): Tab on its
 * last control moves to its first, Shift+Tab on its first to its last.
 *
 * Base UI traps focus already, but by letting it land on a focus guard outside
 * the panel and moving it back on the next frame. For that frame the focus is
 * outside the dialog, and a screen reader can announce it there. Wrapping on the
 * key press keeps the focus in the panel at every instant.
 */
export function wrapTabWithin(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab' || event.defaultPrevented) return
  const stops = tabStopsOf(event.currentTarget)
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (first === undefined || last === undefined) return
  const active = document.activeElement
  const atStart = active === first || active === event.currentTarget
  if (event.shiftKey ? !atStart : active !== last) return
  event.preventDefault()
  ;(event.shiftKey ? last : first).focus()
}
