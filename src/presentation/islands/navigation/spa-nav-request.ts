/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The thin, dependency-free contract other islands use to ASK the `spa-nav`
 * island for a content-only navigation:
 *
 *   - `requestSpaNavigation(url)` — dispatch a request the nav module fulfils
 *     via a content-only swap (used by the ⌘K command palette so a selection
 *     routes through the SPA path instead of a full `window.location.assign`).
 *
 * The event keeps its original `sovrium:admin-navigate` name: renaming a wire
 * event is a change nobody asked this module for, and the console was its
 * only requester when it was named.
 *
 * It rides on `window` rather than the typed cross-island bus
 * (`runtime/event-bus.ts`, which dispatches on `document` behind a CLOSED
 * `SovriumEventName` enum + payload registry) ON PURPOSE: a navigation REQUEST
 * is addressed to one listener, the nav island, and threading it through the
 * global enum would couple it into the shared registry the data-table / drawer
 * / crud islands consume. (`window` vs `document` is incidental — both survive
 * a region swap, since only listeners on elements INSIDE the swapped region
 * are lost, and these hosts live outside it.)
 *
 * ─── THE NOTIFICATION HALF LEFT, AND DID NOT COME BACK ──────────────────
 *
 * There was a second, symmetrical event here — `sovrium:admin-navigated`, with
 * `announceAdminNavigated` / `subscribeAdminNavigated` — whose ONLY subscriber
 * was the hand-written `admin-sidebar` island. That island is gone, replaced by
 * the generic `sidebar` component, which listens for the documented
 * `sovrium:navigated` on `document` (plus `popstate`) like any other app's
 * sidebar would.
 *
 * So the pair was deleted rather than kept alongside: a private event
 * dispatched to nobody is not a contract, it is a second mechanism that looks
 * like one. The nav island announces through the same public event it asks
 * every operator's app to use — see `navigate()` in `spa-nav-controller.ts`,
 * which fires it AFTER `pushState` because that event's precondition is an
 * already-correct `window.location`.
 */

/** The request event: "please SPA-navigate to this URL". */
const NAVIGATE_EVENT = 'sovrium:admin-navigate'

/** Ask the SPA nav module to navigate (content swap) to a URL. */
export function requestSpaNavigation(url: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { url } }))
}

/**
 * Subscribe to SPA navigation requests. Returns an unsubscribe function. The
 * nav module is the sole subscriber; other islands use {@link requestSpaNavigation}.
 */
export function subscribeSpaNavigation(handler: (url: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<{ readonly url?: string }>
    if (detail?.url) handler(detail.url)
  }
  window.addEventListener(NAVIGATE_EVENT, listener)
  return () => window.removeEventListener(NAVIGATE_EVENT, listener)
}
