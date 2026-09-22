/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { subscribe } from '../runtime/event-bus'

/**
 * "The address bar changed without a document load."
 *
 * TWO sources, and the second is the one that matters most:
 *
 *   - `sovrium:navigated`, the documented event a content swapper announces on
 *     `document` once `window.location` already reflects the new path. This is
 *     the cooperating half of the contract.
 *   - `popstate` — browser BACK and FORWARD. Nothing announces those: no island
 *     asked for them and no swapper ran. A sidebar listening only for the
 *     announcement is wrong for the entire time a reader uses the back button,
 *     which is most of how people move through an app they already know.
 *
 * Neither carries the path as an argument. Callers read `window.location`
 * themselves, because the contract's own precondition is that the location is
 * already correct when the signal fires — so a path in the payload would be a
 * second source of truth able to disagree with the address bar.
 *
 * Returns an unsubscribe function; callers MUST call it on unmount.
 */
export function subscribeSidebarNavigation(onNavigated: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const unsubscribeAnnounced = subscribe('sovrium:navigated', () => onNavigated())
  const onPopState = (): void => onNavigated()
  window.addEventListener('popstate', onPopState)
  return () => {
    unsubscribeAnnounced()
    window.removeEventListener('popstate', onPopState)
  }
}

/**
 * The live address, in the shape `sidebarEntryMatches` compares against: the
 * path AND the query.
 *
 * `window.location.pathname` alone is the shape every caller here used before a
 * sidebar had rows differing only by query, and it is now a silent bug rather
 * than a partial answer. The server resolves the mark against the full address
 * (`sidebarRequestAddress`), so a client re-derivation reading only the path
 * would UN-MARK a filter row on the first same-document navigation — the two
 * runtimes disagreeing about `aria-current`, which is worse than the defect
 * this shape exists to fix.
 *
 * One function, so the three call sites cannot drift apart.
 */
export function currentSidebarAddress(): string {
  return `${window.location.pathname}${window.location.search}`
}
