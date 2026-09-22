/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a toast is READ and CLEARED by an operator who is not holding a mouse.
 *
 * The sibling seam to `runtime/toast-duration.ts`, and it exists for the same
 * reason: two renderers raise a `[data-sonner-toaster]` toast — `runtime/toast.ts`
 * (the shared island renderer) and `client.ts#showToast` (the richer variant with
 * an action button) — and they must not import each other, because `client.ts` is
 * the always-loaded client bundle and pulling the island renderer into it would
 * be a payload regression. This module is what they share instead: DOM helpers
 * with no renderer knowledge, importable from both.
 *
 * THREE THINGS IT OWNS, all of them consequences of one defect:
 *
 *  1. **The message gets its own node.** A dismiss control inside `[data-toast]`
 *     joins that element's `textContent`, so a bare `<div data-toast>message</div>`
 *     makes every exact-text assertion in the product read
 *     `Could not save the task.×`. `[data-toast-message]` is the node an exact
 *     read is addressed to instead, and it is emitted by every renderer —
 *     including the two SSR string runtimes that own no dismissal policy — so a
 *     caller can address it without knowing which renderer built the toast.
 *  2. **A toast that never expires carries a way out.** Only that one: a toast
 *     already on a timer has a way out, the published docs describe no control
 *     on it, and adding one would rewrite the text of every toast in the
 *     product. The caller decides — it is the caller that resolved
 *     `resolveToastDuration` — and passes the verdict in.
 *  3. **A failure is announced with a failure's urgency.** See
 *     {@link ASSERTIVE_VARIANTS}.
 *
 * WHY THE ANNOUNCEMENT MOVES ONTO THE TOAST rather than onto the container:
 * the container is built ONCE and reused for every toast that follows, so there
 * is no single element whose politeness can be set per toast. The two available
 * shapes were a second container per politeness, or a live region on the toast
 * itself. The first is refused — a page that declares `page.toasts` must serve
 * exactly ONE standing live region, and a second one makes the selector union
 * `[data-toast-container], [role="status"], [aria-live="polite"]` match twice,
 * reddening eight strict reads in `action-feedback.spec.ts` on a strict-mode
 * violation rather than on anything they test. The second is also the one screen
 * readers handle reliably: `role="alert"` announces on insertion and is the
 * best-supported assertive pattern there is, whereas flipping a standing
 * region's `aria-live` at the same moment as inserting its content is a known
 * anti-pattern — assistive technology samples politeness when the region is
 * registered, so the new value routinely arrives too late to apply.
 */

/**
 * Variants announced ASSERTIVELY, interrupting whatever is being read.
 *
 * The same two names `resolveToastDuration` refuses to put on a timer, and for
 * the same reason: a failure the operator never read is a failure that did not
 * happen. It is NOT imported from there — that module owns timing, this one
 * owns announcement, and a toast could one day persist without being urgent (a
 * toast carrying an action button already does).
 *
 * Everything else stays polite. A blanket switch to assertive is not the fix: it
 * would make every success confirmation interrupt the screen reader, trading a
 * missed failure for a constant one.
 */
const ASSERTIVE_VARIANTS: ReadonlySet<string> = new Set(['error', 'destructive'])

/** The English fallback for the dismiss control's accessible name. */
export const DEFAULT_TOAST_DISMISS_LABEL = 'Dismiss'

/** Whether a toast of this variant interrupts the screen reader. */
function isAssertiveToastVariant(variant?: string): boolean {
  return variant !== undefined && ASSERTIVE_VARIANTS.has(variant)
}

/**
 * Read the localized dismiss label a server-rendered container carries.
 *
 * The label reaches the browser as an SSR attribute — the same server→client
 * channel every other island label uses — because the console ships French and
 * a control whose accessible name is hard-coded English announces the wrong
 * word to the operator it matters most to. A page that declares `page.toasts`
 * is served the attribute by `PageToastContainer`; a container built on the
 * client has nowhere to have read one from, so it falls back to English.
 */
export function resolveToastDismissLabel(container: Element): string {
  const declared = container.getAttribute('data-dismiss-label')
  return declared !== null && declared.trim() !== '' ? declared : DEFAULT_TOAST_DISMISS_LABEL
}

/**
 * Give the toast its message node.
 *
 * Appended rather than assigned to `textContent`, so a caller may add a control
 * beside it without the two texts merging into one unreadable string.
 */
export function appendToastMessage(toast: Element, message: string): void {
  const span = document.createElement('span')
  span.setAttribute('data-toast-message', '')
  /* eslint-disable-next-line functional/immutable-data -- textContent mutation required to render toast text */
  span.textContent = message
  toast.appendChild(span)
}

/**
 * Mark a toast as the urgent kind, when its variant says so.
 *
 * `role="alert"` and nothing else: its implicit `aria-live` is already
 * assertive, and pairing the two makes some assistive technology announce
 * twice.
 */
export function markToastPoliteness(toast: Element, variant?: string): void {
  if (isAssertiveToastVariant(variant)) toast.setAttribute('role', 'alert')
}

/**
 * Give a toast that never expires a control that removes it.
 *
 * A real `<button type="button">`, so it is in the tab order without anyone
 * having to remember a `tabindex` — a control a keyboard operator cannot REACH
 * leaves them with exactly the permanent toast this exists to remove. The
 * accessible name comes from `aria-label` rather than from the glyph, so the
 * label stays localizable while the visible affordance stays the conventional
 * multiplication sign.
 *
 * Removes ONLY its own toast. Clearing the failure an operator has read must
 * not clear the one they have not.
 */
export function appendToastDismissControl(toast: Element, label: string): void {
  const button = document.createElement('button')
  button.setAttribute('type', 'button')
  button.setAttribute('data-toast-dismiss', '')
  button.setAttribute('aria-label', label)
  /* eslint-disable-next-line functional/immutable-data -- textContent mutation required to render the dismiss glyph */
  button.textContent = '×'
  button.addEventListener('click', () => {
    toast.remove()
  })
  toast.appendChild(button)
  installToastEscapeDismiss()
}

/**
 * Let `Escape` clear the most recent dismissible toast.
 *
 * Installed lazily by {@link appendToastDismissControl} and at most once per
 * document, so a page that never raises a persistent toast never registers a
 * key handler. The listener reads the DOM rather than any renderer's state, so
 * it clears a toast whichever renderer built it.
 *
 * The "already installed" flag is an attribute on `<body>` and NOT a
 * module-level boolean, which is the one thing here that looks like it could be
 * simplified and cannot. This module is imported by BOTH `client.ts` (bundled
 * into `client-bundle.js`) and `runtime/toast.ts` (bundled into the island
 * chunks), and a page can load both — two bundles, two module instances, two
 * copies of any module-level state. A boolean would therefore install the
 * handler twice and `Escape` would clear TWO toasts at once, silently taking
 * the unread one with the read one. The DOM is the only state the two bundles
 * actually share.
 *
 * It is deliberately NOT installed at module load: the keyboard route exists so
 * that dismissing does not depend on reaching the control first, and a handler
 * with nothing to dismiss should not be in the way of anything else that reads
 * `Escape`. For the same reason it neither prevents the default nor stops
 * propagation, and returns immediately when no dismissible toast is up — a
 * dialog's own `Escape` handling has to keep working while a toast is on screen.
 */
export function installToastEscapeDismiss(): void {
  if (typeof document === 'undefined') return
  if (document.body.hasAttribute('data-toast-escape-bound')) return
  document.body.setAttribute('data-toast-escape-bound', 'true')
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    dismissMostRecentToast()
  })
}

/**
 * Remove the last toast in the container that carries a dismiss control.
 *
 * "Last" is DOM order, which is insertion order: renderers append, so the most
 * recent toast is the final one. A toast without a control is skipped rather
 * than removed — it is on a timer, and expiring it early is not what `Escape`
 * was pressed for.
 */
function dismissMostRecentToast(): void {
  const dismissible = Array.from(document.querySelectorAll('[data-toast]')).filter(
    (toast) => toast.querySelector('[data-toast-dismiss]') !== null
  )
  dismissible[dismissible.length - 1]?.remove()
}
