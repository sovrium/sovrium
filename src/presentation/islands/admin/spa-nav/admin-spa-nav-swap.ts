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
 * `#admin-surface-content`, re-hydrates the swapped-in islands, and moves focus
 * + resets scroll. It returns the FINAL resolved
 * URL — which differs from the requested URL when the server 302-redirected the
 * partial (a bare object-page path → its first object, Pass 1 item 1.5a), so the
 * caller pushes the redirected URL into history. On ANY non-OK response or fetch
 * error it returns `undefined` so the caller can fall back to a full navigation.
 */

import { hydrateSessionBindings } from '@/presentation/islands/runtime/session-resolver'

/**
 * Reach the island mounter WITHOUT a static edge back to it — the same rule
 * `tabs-island.tsx` follows, and for a sharper reason since 2026-09-01.
 *
 * `island-client.tsx` now bootstraps with a TOP-LEVEL `await`: it awaits the
 * loaders for the priority island types present in the DOM, and `admin-spa-nav`
 * is one of them. A STATIC `import … from '@/presentation/islands/island-client'`
 * here therefore closes a cycle across that await — island-client awaits this
 * island's chunk, whose graph waits for island-client to finish evaluating — and
 * an ES-module cycle through a pending top-level await DEADLOCKS. It does not
 * throw and it logs nothing: the whole admin shell simply renders with no
 * islands mounted, which reads as "the sidebar is missing" rather than as an
 * import problem (measured: it failed 10 of the 10 `shell-spa` specs that way).
 *
 * Loading here instead breaks the static edge. The import resolves from the
 * module map on every call after the first, so the cost is a microtask.
 */
const islandClient = () => import('@/presentation/islands/island-client')

/** The swap-target region id. */
const CONTENT_ID = 'admin-surface-content'

/**
 * The header the partial carries its destination's document title in.
 *
 * Spelled here rather than imported: this module is client-bundle code and the
 * server constant lives in `presentation/api/admin/dashboard-partial.ts`, which
 * the browser must never pull in. The two spellings must agree, and the header
 * is asserted end-to-end by [internal ref].
 */
const TITLE_HEADER = 'X-Sovrium-Title'

/**
 * Adopt the swapped-in surface's document title.
 *
 * A missing header leaves the current title alone: a destination that declares
 * no title is not a destination whose title is empty, and blanking the tab is a
 * louder wrong answer than keeping a stale one.
 */
function adoptTitle(encoded: string | undefined): void {
  if (encoded === undefined || encoded === '') return
  try {
    // eslint-disable-next-line functional/immutable-data -- the title IS the mutation
    document.title = decodeURIComponent(encoded)
  } catch {
    // A malformed percent-sequence would throw; a stale title beats a crashed
    // navigation, so the swap carries on with the title it had.
  }
}

/**
 * Unmount the outgoing surface's islands, swap the markup in, and mount the
 * incoming surface's islands.
 *
 * Tearing down FIRST is load-bearing: `innerHTML` alone orphans each island's
 * `createRoot` root, so its effects keep running — its `document`-level
 * cross-island listeners (`sovrium:open-drawer` etc.) and any body-portalled
 * dialog stay alive, and the re-rendered surface then carries a SECOND,
 * still-listening copy of every island (a row click opening two drawers).
 * Unmounting runs the cleanups.
 *
 * The preload before the mount mirrors the first-load bootstrap: a swapped-in
 * crud-form / split-pane / record-drawer owns its events on the first commit
 * rather than behind a Suspense boundary. Loaders are memoized per type, so a
 * surface revisited later resolves from memory and the await costs a microtask.
 */
async function replaceContent(content: HTMLElement, html: string): Promise<void> {
  const { mountIslandsWithin, preloadIslandsWithin, unmountIslandsWithin } = await islandClient()
  unmountIslandsWithin(content)
  // SECURITY: the partial is server-rendered through the same trusted page
  // pipeline as the full document — not user input.
  // eslint-disable-next-line functional/immutable-data, no-param-reassign -- the SPA swap IS a DOM mutation
  content.innerHTML = html
  await preloadIslandsWithin(content)
  mountIslandsWithin(content)

  // Re-fill the session-bound markers the swap just brought in.
  //
  // The server renders a console surface SESSION-LESS by design, so every
  // `$session.*` marker arrives as a TEMPLATE and the browser resolves it. That
  // pass runs once at page load; a swapped-in region arrives long after it, so
  // without this call every marker in the new surface stays blank — the
  // console root's `Welcome[, $session.name]` greets nobody for an operator who
  // arrived by sidebar rather than by reload.
  //
  // Asking again is safe by construction: the markers keep the template and
  // never the resolved value, which is exactly the property
  // `hydrateSessionBindings` documents itself as having "so that a surface that
  // mounts late can simply ask again". Scoped to `content`, so the shell's own
  // markers are not re-read on every navigation.
  hydrateSessionBindings(content)
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
  // The destination's title, as the partial reported it (see `adoptTitle`).
  // eslint-disable-next-line functional/no-let -- captured across the try boundary
  let encodedTitle: string | undefined
  try {
    const response = await fetch(url, {
      headers: { 'X-Sovrium-Partial': 'content', Accept: 'text/html' },
      signal,
    })
    if (!response.ok) return undefined
    html = await response.text()
    resolvedUrl = response.url || url
    encodedTitle = response.headers.get(TITLE_HEADER) ?? undefined
  } catch {
    return undefined
  }
  if (signal?.aborted) return undefined

  await replaceContent(content, html)
  adoptTitle(encodedTitle)

  // Move focus + reset scroll to the new region (SPA-003 / SPA-008).
  //
  // The sidebar is deliberately NOT re-highlighted here. `sovrium:navigated`
  // promises its subscribers that `window.location` ALREADY names the new path
  // when it fires, and at this point it does not — `pushState` runs in the
  // caller, after this returns. Announcing here would hand the sidebar the old
  // address and mark the row the reader just left. The caller announces.
  content.setAttribute('tabindex', '-1')
  content.focus({ preventScroll: true })
  // eslint-disable-next-line functional/immutable-data -- reset scroll on surface change
  content.scrollTop = 0
  return resolvedUrl
}
