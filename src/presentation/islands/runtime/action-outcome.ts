/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a page action does once it is answered — written ONCE, for every
 * plain-DOM path that answers one: the automation button, row action and menu
 * item, the fetch button and the endpoint form.
 *
 * A success runs in one order:
 *
 *  1. the toast — carried to the next page when the success leaves this one;
 *  2. the surface's own effects (a status region, a refetch, a form reset);
 *  3. `close` — the overlay the control sits in is asked to close, by a
 *     bubbling `sovrium:close-dialog` event each overlay matches against its own
 *     panel, so in two nested overlays only the innermost closes;
 *  4. `navigate` — after a short wait, so the toast can be read and a write the
 *     next page reads has landed; to a path on this site only, through the
 *     canonical redirect check.
 *
 * The keep-pending decision is the caller's and comes first: a success that
 * leaves the page ({@link leavesPage}) keeps the control pending until it
 * goes, so the wait before it leaves cannot send the request again.
 *
 * A failure (R10) gives the control back with the focus on it, then shows
 * `onError`. It never closes and never navigates.
 *
 * Framework-free on purpose: the client runtime that calls it ships no React.
 */

import { isAnotherDocument, resolveRedirectAgainst } from '@/domain/kernel/url/redirect-resolution'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { carryToast, type CarriedToast } from '@/presentation/design/carried-toast'

/** How long a success waits before it navigates: the toast is read, the write has landed. */
const NAVIGATE_DELAY_MS = 500

/** The parts of a success a caller hands over, each optional. */
export interface SuccessOutcome {
  /** Shows the success toast. */
  readonly toast?: (() => void) | undefined
  /** The surface's own effects, between the toast and the close. */
  readonly effects?: (() => void) | undefined
  /** Close the overlay the control sits in. */
  readonly close?: boolean | undefined
  /** Where to go next, every `$record` / `$response` reference already filled. */
  readonly navigate?: string | undefined
  /**
   * Where the caller moves on by itself, when it does not hand the move over
   * as `navigate` (an edit form, which holds its submit until the page goes):
   * a toast is carried to that page exactly as it is for `navigate`.
   */
  readonly movesTo?: string | undefined
  /**
   * A toast the caller showed BEFORE the answer (a fire-and-forget start), so
   * not shown again here — but carried to the next page when the success
   * leaves this one, like `toast`.
   */
  readonly shownToast?: CarriedToast | undefined
}

/**
 * `address` as a path on this site: a relative one (`thanks`, `?sent=1`,
 * `#done`) resolved against the page, an address in full on this origin cut to
 * its path — or `undefined` for another site's address, which an action never
 * follows: it moves the reader within the app, as a form's redirect does. The
 * rule is the kernel's `resolveRedirectAgainst`, the one the server and the
 * sign-in forms apply.
 */
export function onThisSite(address: string | undefined): string | undefined {
  if (typeof window === 'undefined') return undefined
  return resolveRedirectAgainst(address, window.location.href, window.location.origin)
}

/**
 * True when `address` names another document of this site: a different path
 * or query. A `#fragment` on this page stays; another site is never left for.
 */
export function leavesPage(address: string | undefined): boolean {
  const target = onThisSite(address)
  return target !== undefined && isAnotherDocument(target, window.location.href)
}

/** Ask the overlay `control` sits in to close: the innermost one hears it. */
export function requestOverlayClose(control: Element): void {
  control.dispatchEvent(new CustomEvent('sovrium:close-dialog', { bubbles: true }))
}

/**
 * The toast a fire-and-forget start showed before its answer, as
 * {@link SuccessOutcome.shownToast} carries it — none when the start was awaited
 * (its toast is shown by the outcome itself) or the slot declares no words.
 */
export function toastShownAhead(
  awaited: boolean,
  slot: { readonly toast?: { readonly message?: string; readonly variant?: string } } | undefined
): CarriedToast | undefined {
  const toast = slot?.toast
  if (awaited || toast?.message === undefined || toast.message === '') return undefined
  return { message: toast.message, variant: toast.variant }
}

/** The last toast on the page, whichever renderer drew it. */
function lastToast(): Element | undefined {
  const shown = document.querySelectorAll('[data-toast]')
  return shown[shown.length - 1]
}

/**
 * Show a success toast; when `address` leaves the page, keep the toast just
 * drawn for the page the reader lands on (`design/carried-toast.ts`). It is
 * read off the toast itself, so every renderer is carried alike.
 */
function showSuccessToastFor(toast: (() => void) | undefined, address: string | undefined): void {
  if (toast === undefined) return
  if (!leavesPage(address)) return toast()
  const before = lastToast()
  toast()
  const shown = lastToast()
  if (shown === undefined || shown === before) return
  const message = shown.querySelector('[data-toast-message]')?.textContent ?? ''
  if (message === '') return
  const duration = Number(shown.getAttribute('data-duration'))
  carryToast({
    message,
    variant: shown.getAttribute('data-variant') ?? undefined,
    duration: duration > 0 ? duration : undefined,
  })
}

/**
 * Run a success, in the order above. `control` is what was pressed; a surface
 * that does not hand one over (a grid row's action) has no overlay to close.
 */
export function runSuccessOutcome(control: Element | undefined, outcome: SuccessOutcome): void {
  const leavingFor = outcome.navigate ?? outcome.movesTo
  showSuccessToastFor(outcome.toast, leavingFor)
  if (outcome.shownToast !== undefined && leavesPage(leavingFor)) carryToast(outcome.shownToast)
  outcome.effects?.()
  if (outcome.close === true && control !== undefined) requestOverlayClose(control)
  const target = toSafeRedirectPath(onThisSite(outcome.navigate))
  if (target !== undefined) setTimeout(() => window.location.assign(target), NAVIGATE_DELAY_MS)
}

/** Run a failure: the focus back on the control, then the toast. */
export function runErrorOutcome(control: HTMLElement | null, toast?: () => void): void {
  control?.focus()
  toast?.()
}
