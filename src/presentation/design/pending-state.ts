/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pending state of a control whose press sends a request: ONE definition,
 * drawn by every surface that has one.
 *
 * The convention, signed on the design canvas:
 *
 * - the control is `aria-disabled`, `aria-busy="true"` and `data-pending="true"`,
 *   and every handler checks the mark, so a second press — or Enter in a form
 *   whose submit it is — sends nothing; it is never natively `disabled`, which
 *   would drop the keyboard focus to the document;
 * - the house spinner stands BEFORE a pending word that replaces the label, and
 *   takes the place of a leading icon rather than sitting beside it;
 * - the control keeps its full ink: no 50 % fade, which reads as "unavailable"
 *   rather than "working";
 * - everything is restored when the request settles, success or failure —
 *   unless the success leaves the page, when the control stays pending until it
 *   does (a page shown again from the back-forward cache restores it);
 * - nothing is announced on start: the outcome is, by the surface's own
 *   `role="status"` / `role="alert"` feedback.
 *
 * Two trees draw it. React islands spread {@link pendingControlProps} and render
 * the spinner and the word themselves. Plain-DOM runtimes call
 * {@link beginPending} (through `islands/runtime/pending-control.ts`'s
 * `withPending`), and the hosted-form runtime — a string of JavaScript inlined
 * into the page — inlines the SAME function through `String(beginPending)`.
 * That is why it lives here, in the one tier both `render/` and `islands/` may
 * import, and why its body names nothing outside itself.
 */

import type { SpinnerMarkSpec } from './spinner-mark-markup'

/** What {@link beginPending} needs: the word, and the mark to draw before it. */
export interface PendingOptions {
  /**
   * The pending word that replaces the control's label while it is pending.
   * Absent: the label stays, and the spinner takes the place of a leading icon
   * or stands before the label.
   */
  readonly label?: string | undefined
  /** The spinner mark to draw — always `SPINNER_MARK`; passed in so this body imports nothing. */
  readonly spinner: SpinnerMarkSpec
}

/**
 * The attributes a React island spreads on a pending control. It is marked
 * `aria-disabled`, never natively `disabled`: a native `disabled` drops the
 * focus to the document, so a keyboard reader would lose their place for the
 * whole request. The island's press or `submit` handler is the guard that keeps
 * a second press from sending anything.
 */
export function pendingControlProps(pending: boolean):
  | {
      readonly 'aria-busy': 'true'
      readonly 'aria-disabled': 'true'
      readonly 'data-pending': 'true'
    }
  | Record<string, never> {
  return pending ? { 'aria-busy': 'true', 'aria-disabled': 'true', 'data-pending': 'true' } : {}
}

/**
 * Put a control in its pending state and return the function that restores it,
 * or `undefined` when the control is already pending (the caller must then send
 * nothing).
 *
 * SELF-CONTAINED BY CONTRACT: the hosted-form runtime inlines this body with
 * `String(beginPending)`, and the release binary is minified, so the body must
 * reference no identifier declared outside it — not even a shared constant for
 * the `data-pending` mark, which is spelled out below for that reason.
 * `form-runtime-pending.test.ts` runs the minified string to hold this.
 *
 * An `<input type="submit">` has no children to draw a mark in: it gets the word
 * as its value and no spinner. The space beside the mark separates it from the
 * word in an inline control; a flex control drops it and uses its own gap.
 */
export function beginPending(
  control: HTMLElement,
  options: PendingOptions
): (() => void) | undefined {
  if (control.getAttribute('data-pending') === 'true') return undefined
  const { label, spinner } = options
  const isInput = control.tagName === 'INPUT'
  const priorDisabled = control.getAttribute('aria-disabled')
  const priorBusy = control.getAttribute('aria-busy')
  const priorValue = control.getAttribute('value')
  const priorChildren = Array.from(control.childNodes)
  const view = control.ownerDocument.defaultView
  const restoreAttribute = (name: string, prior: string | null): void =>
    prior === null ? control.removeAttribute(name) : control.setAttribute(name, prior)
  const drawPending = (): void => {
    if (isInput) return label ? control.setAttribute('value', label) : undefined
    const mark = control.ownerDocument.createElementNS(spinner.namespace, 'svg')
    Object.keys(spinner.attributes).forEach((name) =>
      mark.setAttribute(name, spinner.attributes[name] ?? '')
    )
    const arc = control.ownerDocument.createElementNS(spinner.namespace, 'path')
    arc.setAttribute('d', spinner.path)
    mark.append(arc)
    // The leading icon: the first node that is not blank text, when it is an <svg>.
    const leading = priorChildren.find((node) => node.nodeType !== 3 || node.textContent?.trim())
    const icon = leading?.nodeName.toLowerCase() === 'svg' ? leading : undefined
    if (label) control.replaceChildren(mark, ' ', label)
    else if (icon) icon.replaceWith(mark)
    else control.prepend(mark, ' ')
  }
  function restore(): void {
    if (control.getAttribute('data-pending') !== 'true') return
    view?.removeEventListener('pageshow', onShow)
    if (isInput) restoreAttribute('value', priorValue)
    else control.replaceChildren(...priorChildren)
    control.removeAttribute('data-pending')
    restoreAttribute('aria-busy', priorBusy)
    restoreAttribute('aria-disabled', priorDisabled)
  }
  // A page shown again from the back-forward cache never comes back stuck.
  function onShow(event: PageTransitionEvent): void {
    if (event.persisted) restore()
  }
  control.setAttribute('data-pending', 'true')
  control.setAttribute('aria-busy', 'true')
  control.setAttribute('aria-disabled', 'true')
  view?.addEventListener('pageshow', onShow)
  drawPending()
  return restore
}
