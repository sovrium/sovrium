/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Keeps keyboard focus inside a record sheet when the footer action that held
 * it stops being drawn.
 *
 * A footer action that writes its own record makes the sheet read it again,
 * and two things then take the focused button away: it is disabled while the
 * record re-reads, and if its `visibleWhen` no longer matches it is not drawn
 * at all. Either way the browser drops focus to `<body>`, outside the dialog,
 * and a keyboard operator is thrown back to the top of the page.
 *
 * So the button that fired is held, with the sheet it belongs to, and once the
 * sheet has settled focus goes back to it, or, when it is gone, to the sheet's
 * Close button. Only while nothing else holds the focus: once the operator has
 * moved on, the hold is dropped. A sheet that closed is left to its own focus
 * return.
 */

/** The footer control that fired, and the sheet it was drawn in. */
export interface ActionFocusHold {
  readonly control: HTMLElement
  readonly sheet: Element
}

/** Remember `control` as the one focus belongs to, if it sits in a sheet. */
export function holdActionFocus(control: HTMLElement): ActionFocusHold | undefined {
  const sheet = control.closest('[data-slot="sheet-content"]')
  return sheet === null ? undefined : { control, sheet }
}

/** Nothing but `control` (or `<body>`) holds the focus. */
const isFocusFree = (control: HTMLElement): boolean => {
  const active = document.activeElement
  return active === null || active === document.body || active === control
}

/** The control still drawn and usable, else the sheet's own Close. */
const focusTarget = (hold: ActionFocusHold): HTMLElement | null => {
  const { control, sheet } = hold
  if (control.isConnected && !(control as HTMLButtonElement).disabled) return control
  return sheet.querySelector<HTMLElement>('[data-slot="sheet-close"]')
}

/**
 * Spend a hold once the sheet is done re-reading: focus goes back to the
 * control, or to Close, unless the sheet closed or focus moved on.
 */
export function settleActionFocus(hold: ActionFocusHold): void {
  if (!hold.sheet.isConnected || !isFocusFree(hold.control)) return
  const target = focusTarget(hold)
  if (target !== null && document.activeElement !== target) target.focus()
}
