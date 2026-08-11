/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared SPA-nav glue for the Native Admin Dashboard shell
 *.
 *
 * The SPA client nav module (`admin-spa-nav-island`) owns the actual content
 * swap; this module is the thin, dependency-free contract other islands use to
 * (a) ASK for an SPA navigation and (b) be NOTIFIED when one completed:
 *
 *   - `navigateAdminSpa(url)` — dispatch a request the nav module fulfils via a
 *     content-only swap (used by the ⌘K command palette so a selection routes
 *     through the SPA path instead of a full `window.location.assign`).
 *   - `subscribeAdminNavigated(handler)` — listen for the path the nav module
 *     swapped to (used by the persistent sidebar to re-highlight the active row,
 *     since it is NOT re-created on a content swap).
 *
 * These ride on `window` rather than the typed cross-island bus
 * (`_shared/event-bus.ts`, which dispatches on `document` behind a CLOSED
 * `SovriumEventName` enum + payload registry) ON PURPOSE: the admin SPA nav is
 * an admin-dashboard-local concern, and threading two admin-only events through
 * the global enum would couple a niche surface into the shared registry that the
 * data-table / drawer / crud islands consume. Keeping the glue here decouples the
 * SPA contract from that registry. (`window` vs `document` is incidental — both
 * survive the `#admin-surface-content` `innerHTML` swap, since only listeners on
 * elements INSIDE the swapped region are lost, and these hosts live outside it.)
 */

/** The request event: "please SPA-navigate to this `/_admin/*` URL". */
const NAVIGATE_EVENT = 'sovrium:admin-navigate'
/** The notification event: "the content region just swapped to this path". */
const NAVIGATED_EVENT = 'sovrium:admin-navigated'

/** Ask the SPA nav module to navigate (content swap) to a `/_admin/*` URL. */
export function navigateAdminSpa(url: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { url } }))
}

/**
 * Subscribe to SPA navigation requests. Returns an unsubscribe function. The
 * nav module is the sole subscriber; other islands use {@link navigateAdminSpa}.
 */
export function subscribeAdminNavigate(handler: (url: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<{ readonly url?: string }>
    if (detail?.url) handler(detail.url)
  }
  window.addEventListener(NAVIGATE_EVENT, listener)
  return () => window.removeEventListener(NAVIGATE_EVENT, listener)
}

/** Announce that the content region swapped to `path` (`/_admin`-stripped). */
export function announceAdminNavigated(path: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NAVIGATED_EVENT, { detail: { path } }))
}

/**
 * Subscribe to completed SPA navigations. Returns an unsubscribe function. Used
 * by the persistent sidebar to refresh its active-row highlight after a swap.
 */
export function subscribeAdminNavigated(handler: (path: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<{ readonly path?: string }>
    if (typeof detail?.path === 'string') handler(detail.path)
  }
  window.addEventListener(NAVIGATED_EVENT, listener)
  return () => window.removeEventListener(NAVIGATED_EVENT, listener)
}
