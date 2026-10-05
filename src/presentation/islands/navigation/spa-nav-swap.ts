/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content-swap mechanics for the `spa-nav` island. Split from
 * `spa-nav-island.tsx` to keep the island under the eco `max-lines: 250` cap.
 *
 * `performSpaSwap` fetches a page's content-only partial (header
 * `X-Sovrium-Partial: content`), swaps it into the navigation's region,
 * re-hydrates the swapped-in islands, and moves focus + resets scroll. The
 * region is swapped one of two ways, by scope:
 *
 *   - `mount` (the operator console): the partial is the region's INNER HTML
 *     and replaces its children, so the region node itself survives the swap
 * ([internal ref] asserts it does);
 *   - `app` (an app's own pages): the partial is the region's OUTER element and
 *     replaces the region node.
 *
 * It reports the FINAL resolved URL — which differs from the requested URL
 * when the server 302-redirected the partial (a bare object-page path → its
 * first object, Pass 1 item 1.5a), so the caller pushes the redirected URL
 * into history. On anything that is not a partial it reports a fallback URL
 * so the caller can run a full navigation instead.
 */

import { hydrateSessionBindings } from '@/presentation/islands/runtime/session-resolver'
import {
  adoptDensity,
  adoptTitle,
  ensureClientScript,
  fetchPartial,
  type PartialAnswer,
  type SpaNavScope,
} from './spa-nav-partial'

/**
 * Reach the island mounter WITHOUT a static edge back to it — the same rule
 * `tabs-island.tsx` follows, and for a sharper reason since 2026-09-01.
 *
 * `island-client.tsx` bootstraps with a TOP-LEVEL `await`: it awaits the
 * loaders for the priority island types present in the DOM, and `spa-nav`
 * (registered as `admin-spa-nav` too) is one of them. A STATIC
 * `import … from '@/presentation/islands/island-client'` here therefore closes
 * a cycle across that await — island-client awaits this island's chunk, whose
 * graph waits for island-client to finish evaluating — and an ES-module cycle
 * through a pending top-level await DEADLOCKS. It does not throw and it logs
 * nothing: the whole admin shell simply renders with no islands mounted, which
 * reads as "the sidebar is missing" rather than as an import problem
 * (measured: it failed 10 of the 10 `shell-spa` specs that way).
 *
 * Loading here instead breaks the static edge. The import resolves from the
 * module map on every call after the first, so the cost is a microtask.
 */
const islandClient = () => import('@/presentation/islands/island-client')

/** The region a navigation swaps, and the scope it swaps it in. */
export interface SpaRegion {
  readonly regionId: string
  readonly scope: SpaNavScope
}

/** What a swap attempt ended in. */
export type SpaSwapOutcome =
  | { readonly swapped: true; readonly url: string }
  | { readonly swapped: false; readonly fallbackUrl: string }

/**
 * The incoming region element of an `app`-scope partial, parsed BEFORE the
 * outgoing surface is torn down — so a partial that does not hold the region
 * falls back to a full navigation with the current surface still intact.
 */
function parseIncomingRegion(html: string, regionId: string): HTMLElement | undefined {
  const template = document.createElement('template')
  // SECURITY: the partial is server-rendered through the same trusted page
  // pipeline as the full document — not user input. A `<template>` parses it
  // inert: nothing in it runs or loads until it is placed in the document.
  // eslint-disable-next-line functional/immutable-data -- parsing into an inert template IS the mutation
  template.innerHTML = html
  const incoming = template.content.getElementById(regionId)
  return incoming instanceof HTMLElement ? incoming : undefined
}

/**
 * Unmount the outgoing surface's islands, swap the markup in, and mount the
 * incoming surface's islands. Returns the element now holding the region.
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
async function replaceRegion(
  region: HTMLElement,
  html: string,
  incoming: HTMLElement | undefined
): Promise<HTMLElement> {
  const client = await islandClient()
  client.unmountIslandsWithin(region)
  // The islands share one query cache per page. The outgoing surface's answers
  // are kept but marked stale, so a surface revisited remounts from them and
  // refreshes in the background (see `staleInactivePageQueries`).
  client.staleInactivePageQueries()
  if (incoming === undefined) {
    // SECURITY: the partial is server-rendered through the same trusted page
    // pipeline as the full document — not user input.
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- the SPA swap IS a DOM mutation
    region.innerHTML = html
  } else {
    region.replaceWith(incoming)
  }
  const current = incoming ?? region
  await client.preloadIslandsWithin(current)
  client.mountIslandsWithin(current)

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
  // mounts late can simply ask again". Scoped to the region, so the shell's
  // own markers are not re-read on every navigation.
  hydrateSessionBindings(current)
  return current
}

/** Apply everything a partial carries for the document around the region. */
function adoptDocumentState(answer: PartialAnswer): void {
  adoptTitle(answer.title)
  adoptDensity(answer.density)
  if (answer.needsClient) ensureClientScript()
}

/**
 * Fetch a page's content-only partial and swap it into the navigation's
 * region. Reports the FINAL resolved URL on a successful swap (the redirected
 * URL when the server 302'd the partial — e.g. `/_admin/tables` →
 * `/_admin/tables/contacts`, Pass 1 item 1.5a), or the URL a full navigation
 * should load when the answer was not a swappable partial.
 *
 * @param url - the URL to navigate to
 * @param region - the region to swap, and the scope it swaps in
 * @param signal - optional AbortSignal so a rapid follow-up nav can cancel this
 */
export async function performSpaSwap(
  url: string,
  region: SpaRegion,
  signal?: AbortSignal
): Promise<SpaSwapOutcome> {
  const outgoing = document.getElementById(region.regionId)
  if (!outgoing) return { swapped: false, fallbackUrl: url }

  const fetched = await fetchPartial(url, region.scope, signal)
  if (!fetched.ok) return { swapped: false, fallbackUrl: fetched.fallbackUrl }
  if (signal?.aborted) return { swapped: false, fallbackUrl: url }

  const { answer } = fetched
  const incoming =
    region.scope === 'app' ? parseIncomingRegion(answer.html, region.regionId) : undefined
  if (region.scope === 'app' && incoming === undefined) {
    return { swapped: false, fallbackUrl: answer.url }
  }

  const current = await replaceRegion(outgoing, answer.html, incoming)
  adoptDocumentState(answer)

  // Move focus + reset scroll to the new region (SPA-003 / SPA-008).
  //
  // The sidebar is deliberately NOT re-highlighted here. `sovrium:navigated`
  // promises its subscribers that `window.location` ALREADY names the new path
  // when it fires, and at this point it does not — `pushState` runs in the
  // caller, after this returns. Announcing here would hand the sidebar the old
  // address and mark the row the reader just left. The caller announces.
  current.setAttribute('tabindex', '-1')
  current.focus({ preventScroll: true })
  // eslint-disable-next-line functional/immutable-data -- reset scroll on surface change
  current.scrollTop = 0
  return { swapped: true, url: answer.url }
}
