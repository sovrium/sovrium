/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `fill` client action: write a value into a form control on the page, as
 * if the reader had typed it.
 *
 * Two doors reach it, and both land in {@link applyFill}:
 *  - a `button[data-action-type="fill"]`, whose `data-action-config` carries the
 *    action with its `$record.*` already resolved by the server (a button drawn
 *    in a list row, or anywhere on the page);
 *  - the `sovrium:fill` event, dispatched by an island that resolved the value
 *    against a record it holds (a list item click, a board drop hook). The
 *    islands dispatch rather than import this module so the fill costs them a
 *    few bytes instead of a shared chunk.
 *
 * The value is written as TEXT through the control's `value` — never parsed as
 * HTML, never evaluated. A target that is not in the document when the action
 * runs (its form sits in a dialog that is closed) is a silent no-op: the action
 * names a place that is not there yet, which is not an error the reader can act
 * on.
 */

import { bindActionButtons } from './client-event-delegate'
import type { FillDetail } from './event-bus'

type FillControl = HTMLInputElement | HTMLTextAreaElement

/**
 * The control a fill writes into: the one named `field` inside the target (a
 * form), else the target itself when it IS a control (a standalone `input` /
 * `textarea` component), else its first text control. A form's honeypot is
 * hidden and out of the tab order, which keeps it out of the last case.
 */
function findControl(target: string, field: unknown): FillControl | undefined {
  const host = document.getElementById(target)
  const control =
    typeof field === 'string'
      ? host?.querySelector(`[name="${CSS.escape(field)}"]`)
      : host?.matches('input, textarea')
        ? host
        : host?.querySelector('textarea, input:not([type="hidden"]):not([tabindex="-1"])')
  return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
    ? control
    : undefined
}

/**
 * Write a fill into its control: replace or append, focus the control with the
 * cursor at the end, and announce the change with one bubbling `input` (and a
 * `change`) so the form's own state hears it the way it hears typing. The
 * value goes through the PROTOTYPE's setter, so a control a React island owns
 * sees the change as its own `onChange` would.
 */
function applyFill(fill: Partial<FillDetail> | undefined): void {
  if (typeof fill?.target !== 'string' || typeof fill.value !== 'string') return
  const control = findControl(fill.target, fill.field)
  // A file input's value cannot be set from script (the browser throws), so a fill never targets one.
  if (control === undefined || control.type === 'file') return
  const next = fill.mode === 'append' ? control.value + fill.value : fill.value
  control.focus()
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set?.call(control, next)
  if (control.selectionStart !== null) control.setSelectionRange(next.length, next.length)
  control.dispatchEvent(new Event('input', { bubbles: true }))
  control.dispatchEvent(new Event('change', { bubbles: true }))
}

/** The fill a button carries in `data-action-config`, or `undefined` when unreadable. */
function readButtonFill(button: HTMLButtonElement): Partial<FillDetail> | undefined {
  try {
    return JSON.parse(button.getAttribute('data-action-config') ?? '') as Partial<FillDetail>
  } catch {
    return undefined
  }
}

/** Bind the two doors: fill buttons, and the islands' `sovrium:fill` event. */
export function setupFillHandlers(): void {
  bindActionButtons('fill', (button) => applyFill(readButtonFill(button)))
  document.addEventListener('sovrium:fill', (event) =>
    applyFill((event as CustomEvent<FillDetail | undefined>).detail)
  )
}
