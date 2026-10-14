/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A success toast carried to the next page of this site.
 *
 * A success that shows a toast and then moves to another page draws the toast
 * on the page being left; the reader lands on a page that says nothing. So the
 * toast is kept in the tab's session storage under `sovrium:flash-toast` just
 * before the move, and the first page that loads afterwards shows it once and
 * clears it — a reload shows nothing more, and a carried toast older than a
 * minute is dropped, so a reader who leaves and comes back later is not told
 * about an old save.
 *
 * Two trees write it: the plain-DOM and island runtimes call {@link carryToast},
 * and the hosted-form runtime — a string of JavaScript inlined into the page —
 * inlines the SAME function through `String(carryToast)`. That is why it lives
 * here, in the one tier both `render/` and `islands/` may import, and why its
 * body names nothing outside itself: the key and the clock are written inline.
 * It is read back with {@link takeCarriedToast} by the inline script every page
 * carries at the end of its body (`render/scripts/carried-toast-reader-script.ts`),
 * which draws it in the page's toaster, creating one when the page has none.
 *
 * Storage that refuses (a private window over quota, storage disabled) loses
 * the carried toast and nothing else: the move still happens.
 */

/** The session-storage key a carried toast rides under. */
export const CARRIED_TOAST_KEY = 'sovrium:flash-toast'

/** How long a carried toast stays worth showing, in milliseconds. */
export const CARRIED_TOAST_LIFETIME_MS = 60_000

/** What a carried toast keeps: its words, its variant, its authored duration. */
export interface CarriedToast {
  readonly message: string
  readonly variant?: string | undefined
  readonly duration?: number | undefined
}

/**
 * Keep `toast` for the next page of this site. Self-contained: inlined by
 * `String(carryToast)` into the hosted-form runtime.
 */
export function carryToast(toast: CarriedToast): void {
  try {
    globalThis.sessionStorage.setItem(
      'sovrium:flash-toast',
      JSON.stringify({
        message: toast.message,
        variant: toast.variant,
        duration: toast.duration,
        at: Date.now(),
      })
    )
  } catch {
    // Storage refused: the toast stays on the page being left, as before.
  }
}

/**
 * The toast a previous page carried here, cleared as it is read — or
 * `undefined` when there is none, it is older than a minute, or the storage
 * refuses. Self-contained like {@link carryToast}: the inline page runtime
 * inlines it through `String(takeCarriedToast)`, so the key and the lifetime
 * are written in its body (the unit test holds them to the constants above).
 * The message comes back as a string for a renderer that sets it as TEXT; a
 * variant outside the renderers' list and a duration that is not a positive
 * delay are dropped.
 */
export function takeCarriedToast(now: number = Date.now()): CarriedToast | undefined {
  // A kept payload as a toast, when it is one and is still fresh.
  const asToast = (kept: Readonly<Record<string, unknown>>): CarriedToast | undefined => {
    const { message, variant, duration, at } = kept
    const fresh = typeof at === 'number' && now >= at && now - at <= 60_000
    if (!fresh || typeof message !== 'string' || message === '') return undefined
    // The payload is data anyone on this origin can write: the variant is one
    // the toast renderers know or none, the duration a positive finite delay.
    const knownVariant = ['default', 'success', 'info', 'warning', 'error', 'destructive'].includes(
      variant as string
    )
    const timed = typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    return {
      message,
      variant: knownVariant ? (variant as string) : undefined,
      duration: timed ? duration : undefined,
    }
  }
  try {
    const store = globalThis.sessionStorage
    const raw = store.getItem('sovrium:flash-toast')
    if (raw === null) return undefined
    store.removeItem('sovrium:flash-toast')
    return asToast(JSON.parse(raw) as Readonly<Record<string, unknown>>)
  } catch {
    // Storage refused, or a payload that is not a carried toast: nothing to show.
    return undefined
  }
}
