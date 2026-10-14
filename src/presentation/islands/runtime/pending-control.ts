/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Hold a control pending while the request its press sent is in flight.
 *
 * The plain-DOM runtimes' entry to the pending convention — action buttons,
 * endpoint forms, data-table row actions. The state itself (attributes,
 * spinner, word, restore) is `beginPending` in `design/pending-state.ts`, the
 * one definition the inlined hosted-form runtime shares too; this file adds the
 * lifetime: begin, run, restore in `finally`.
 *
 * Framework-free on purpose: the client runtime that calls it ships no React.
 * A React island does not call it either — React owns that button's children —
 * and spreads `pendingControlProps` instead.
 */

import { beginPending } from '@/presentation/design/pending-state'
import { SPINNER_MARK } from '@/presentation/design/spinner-mark-markup'

/** The caller's half of the options: the mark is always the house spinner. */
export interface WithPendingOptions<T> {
  /** The pending word that replaces the label; absent keeps the label beside the spinner. */
  readonly label?: string | undefined
  /**
   * True when this result leaves the page (a navigation to another address, a
   * reload): the control then stays pending until the page goes, so the wait
   * before it leaves cannot send the request again.
   */
  readonly keepPending?: (result: T) => boolean
}

/**
 * Run `run` with `control` pending, and restore the control when it settles —
 * unless `keepPending` says the result leaves the page.
 *
 * Returns `undefined` WITHOUT calling `run` when the control is already
 * pending: that is the double-press guard, and a caller must treat it as "this
 * press sent nothing". A rejection from `run` propagates after the restore, so
 * the caller's own error feedback runs on a control that is usable again.
 */
export async function withPending<T>(
  control: HTMLElement,
  options: WithPendingOptions<T>,
  run: () => Promise<T>
): Promise<T | undefined> {
  const begun = beginPending(control, { label: options.label, spinner: SPINNER_MARK })
  if (begun === undefined) return undefined
  const unlock = lockModalClose(control)
  const restore = (): void => {
    begun()
    unlock()
  }
  const result = await run().catch((error: unknown) => {
    restore()
    throw error
  })
  if (options.keepPending?.(result) !== true) restore()
  return result
}

/**
 * Disable the close control of the `hydrate: false` dialog a pending control
 * sits in, for as long as it is pending, and return what gives it back. The
 * hydrated overlays do the same from their own panel (`overlays/overlay-pending.ts`).
 */
function lockModalClose(control: HTMLElement): () => void {
  const closers = Array.from(
    control.closest('[data-modal-container]')?.querySelectorAll('[data-modal-close]') ?? []
  ).filter((closer) => !closer.hasAttribute('disabled'))
  closers.forEach((closer) => closer.setAttribute('disabled', ''))
  return () => closers.forEach((closer) => closer.removeAttribute('disabled'))
}

/**
 * The press guard of an island control drawn pending with `pendingControlProps`.
 * Such a control is `aria-disabled`, not natively `disabled` (so it keeps the
 * keyboard focus), which means a press still reaches its handlers: each handler
 * asks this first. True — and the event's default prevented, so a form posts
 * nothing — when the pressed control, or the form holding it, is pending.
 */
export function pressWhilePending(event: {
  readonly currentTarget: EventTarget | null
  readonly preventDefault: () => void
}): boolean {
  const target = event.currentTarget
  const busy =
    target instanceof Element &&
    (target.matches('[data-pending="true"]') ||
      target.querySelector('[data-pending="true"]') !== null)
  if (busy) event.preventDefault()
  return busy
}
