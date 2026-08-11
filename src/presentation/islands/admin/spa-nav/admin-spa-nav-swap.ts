/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SPA content-swap mechanics for the Native Admin Dashboard shell
 *. Split from `admin-spa-nav-island` to keep the
 * island under the eco `max-lines: 250` cap.
 *
 * `performSpaSwap` fetches a surface's content-only partial (header
 * `X-Sovrium-Partial: content`), replaces the inner HTML of
 * `#admin-surface-content`, re-hydrates the swapped-in islands, re-highlights
 * the sidebar, and moves focus + resets scroll. It returns the FINAL resolved
 * URL — which differs from the requested URL when the server 302-redirected the
 * partial (a bare object-page path → its first object, Pass 1 item 1.5a), so the
 * caller pushes the redirected URL into history. On ANY non-OK response or fetch
 * error it returns `undefined` so the caller can fall back to a full navigation.
 */

import { mountIslandsWithin, unmountIslandsWithin } from '@/presentation/islands/island-client'
import { announceAdminNavigated } from './admin-spa-nav'

/** The swap-target region id. */
const CONTENT_ID = 'admin-surface-content'

/** Strip the `/_admin` prefix to the dashboard-relative active path. */
function toActivePath(pathname: string): string {
  return pathname.replace(/^\/_admin/, '') || '/'
}

/**
 * Fetch a surface's content-only partial and swap it into the content region.
 * Returns the FINAL resolved URL on a successful swap (the redirected URL when the
 * server 302'd the partial — e.g. `/_admin/tables` → `/_admin/tables/contacts`,
 * Pass 1 item 1.5a), or `undefined` when the partial was non-OK or the fetch
 * failed (the caller then falls back to a full navigation).
 *
 * @param url - the `/_admin/*` URL to navigate to
 * @param signal - optional AbortSignal so a rapid follow-up nav can cancel this
 */
export async function performSpaSwap(
  url: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  const content = document.getElementById(CONTENT_ID)
  if (!content) return undefined

  // eslint-disable-next-line functional/no-let -- response captured across the try boundary
  let html: string
  // The final URL after any server redirect — `fetch` follows 302s transparently,
  // so `response.url` is the redirected target when a bare object-page path
  // resolved to its first object (Pass 1 item 1.5a). Falls back to the requested
  // URL when the response exposes no `url` (defensive).
  // eslint-disable-next-line functional/no-let -- captured across the try boundary
  let resolvedUrl: string = url
  try {
    const response = await fetch(url, {
      headers: { 'X-Sovrium-Partial': 'content', Accept: 'text/html' },
      signal,
    })
    if (!response.ok) return undefined
    html = await response.text()
    resolvedUrl = response.url || url
  } catch {
    return undefined
  }
  if (signal?.aborted) return undefined

  // Tear down the OUTGOING surface's island roots BEFORE replacing the content.
  // `innerHTML` alone orphans each island's `createRoot` root: its effects keep
  // running, so its `document`-level cross-island listeners (`sovrium:open-drawer`
  // etc.) and any body-portalled dialog stay alive. A re-rendered surface would
  // then carry a SECOND, still-listening copy of every island — e.g. a row click
  // would open two record-detail drawers. Unmounting first runs the cleanups.
  unmountIslandsWithin(content)
  // Swap the content region. SECURITY: the partial is server-rendered through
  // the same trusted page pipeline as the full document — not user input.
  // eslint-disable-next-line functional/immutable-data -- the SPA swap IS a DOM mutation
  content.innerHTML = html
  mountIslandsWithin(content)

  // Re-highlight the sidebar (it is NOT re-created on a content swap) and move
  // focus + reset scroll to the new region (SPA-003 / SPA-008). Highlight from the
  // RESOLVED path so a redirected nav (bare → first object) activates the right row.
  announceAdminNavigated(toActivePath(new URL(resolvedUrl, window.location.origin).pathname))
  content.setAttribute('tabindex', '-1')
  content.focus({ preventScroll: true })
  // eslint-disable-next-line functional/immutable-data -- reset scroll on surface change
  content.scrollTop = 0
  return resolvedUrl
}
