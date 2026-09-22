/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-read the SERVER-RENDERED regions a fetch action's `onSuccess.refetch` names.
 *
 * ─── THE HALF OF THE PROMISE THAT WAS NOT KEPT ─────────────────────────────
 *
 * `onSuccess.refetch` says the named components "re-issue their read (a DB-table
 * `dataSource` OR a `dataSource.system` read endpoint)". That was true of one
 * shape only. `applyFetchSuccessEffects` dispatches `sovrium:refetch` on the
 * island event bus, and the data-table island is the sole subscriber — so a
 * component that owns its own client-side fetch re-reads, and a component the
 * server rendered in full does not.
 *
 * A layout node bound to a data source is the second shape, and it ships no
 * client code at all: the row template is expanded into the HTML during the page
 * render, so a `refetch` naming it dispatched an event into an empty room. The
 * visible failure is the worst kind — the write succeeds, the toast says so, and
 * the list still shows the pre-write rows until the reader reloads by hand. The
 * page reports two different truths about the same data and gives no sign which
 * one is current.
 *
 * ─── WHY THE PAGE, AND NOT THE ENDPOINT ────────────────────────────────────
 *
 * The obvious repair is to re-read the bound endpoint and re-expand the row
 * template in the browser. That means shipping a second copy of the renderer —
 * `$record.` substitution, per-row `visibility.record` gating, the row wrapper
 * rules — to the client, where it would be free to drift from the server's. A
 * per-row permission gate that fired on the server and silently did nothing on a
 * client re-render is exactly the failure `system-rows-template-resolver.ts`
 * warns about.
 *
 * So the server re-renders and the client swaps a subtree, which is the shape
 * the admin shell's SPA navigation already uses (`admin-spa-nav-swap.ts`). Two
 * properties make it faithful rather than clever:
 *
 *  - a page whose component tree carries a `dataSource` classifies as
 *    `'dynamic'` (`classifyPageCacheability`), so it is NEVER served from the
 *    page cache and the re-read genuinely re-runs the expansion;
 *  - the read is the CURRENT url with the caller's own cookies, so the rows are
 *    exactly the rows this visitor could have seen — the same identity rule the
 *    server-side fetcher follows (S1).
 *
 * The cost is one page render per refetch rather than one endpoint read. That is
 * the trade this makes deliberately: it is paid only when a reader actually
 * mutates something, and it buys ONE renderer instead of two.
 *
 * ─── WHAT THIS COSTS A PAGE THAT NEVER CALLS IT ────────────────────────────
 *
 * Nothing. There is no island and no listener: a bound region does not subscribe
 * to anything, and is re-read by the action that names it. So the bytes land in
 * the module the fetch executor already pulls in, which is present on exactly
 * the pages that can fire a refetch, and a page holding a bound region and no
 * action ships none of it (ecoconception R2).
 *
 * ─── WHY THE SWAPPED MARKUP IS ALSO ALIVE ──────────────────────────────────
 *
 * A region that comes back correct but INERT is the same defect wearing better
 * clothes, and that is what the first version of this shipped: the page runtime
 * bound its handlers by sweeping the document once at `DOMContentLoaded`, so a
 * confirm-gated button swapped in here carried its whole configuration and no
 * listener at all. Clicking it opened no dialog and fired no action.
 *
 * The repair is not here. `presentation/client.ts` now DELEGATES every handler
 * from `document` — see `delegate` there — so a node that arrives in a swap is
 * live on its first click without this module knowing anything about it, and
 * the next thing to replace a node inherits that for free.
 *
 * What remains here is the one binding that is not an event and so cannot be
 * delegated: the session-bound fill, re-applied by {@link swapRegion}.
 */

import { hydrateSessionBindings } from './session-resolver'

/** A live region to refresh, paired with the freshly rendered copy of itself. */
interface RegionSwap {
  readonly live: HTMLElement
  readonly fresh: Element
}

/**
 * The regions a refetch names that this module owns.
 *
 * An id resolving to an island host — or to anything inside one — is skipped:
 * that component subscribes to `sovrium:refetch` and re-reads itself, and
 * writing over its markup would clobber DOM a React root still believes it
 * owns. `closest` covers both, since the author's `props.id` may sit on the
 * island host or on an element within it.
 *
 * A region that merely CONTAINS an island is skipped too, for the reason
 * {@link holdsMountedIsland} sets out, and so is one holding a destructive
 * question the reader has open — see {@link holdsOpenConfirmGate}.
 */
function serverRenderedTargets(ids: readonly string[]): readonly HTMLElement[] {
  return ids.flatMap((id) => {
    const element = document.getElementById(id)
    if (!element || element.closest('[data-island]')) return []
    if (holdsMountedIsland(element)) return []
    if (holdsOpenConfirmGate(element)) return []
    return [element]
  })
}

/**
 * Re-render the current page and return it PARSED, or `undefined`.
 *
 * `cache: 'no-store'` is not belt-and-braces: the document is being re-read in
 * order to observe a write that just landed, and a heuristically cached copy
 * would answer with the very rows this call exists to replace.
 *
 * `DOMParser` builds an inert document — a `<script>` it parses is never
 * executed, and nothing here adopts a node out of it into the live tree, so the
 * parse cannot run anything.
 */
async function fetchRenderedPage(): Promise<Document | undefined> {
  try {
    const response = await fetch(window.location.href, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'text/html' },
    })
    if (!response.ok) return undefined
    return new DOMParser().parseFromString(await response.text(), 'text/html')
  } catch {
    return undefined
  }
}

/**
 * Replace one region's contents with its freshly rendered copy.
 *
 * SECURITY (standing rule S2): the markup written here was produced moments ago
 * by our own page renderer, for this request and this session, and is the same
 * bytes the document already in the DOM was built from — it is not user input
 * reaching the DOM by a new route, so no second sanitiser is introduced. Record
 * values inside it were escaped by the server's own render exactly as on first
 * load.
 *
 * `innerHTML` rather than adopting the parsed nodes, and the distinction is a
 * real one: assigning a string never executes a `<script>` in it, whereas
 * adopting a parsed script element into the live document can. The outer element
 * is left standing, so its id, classes and author attributes survive untouched.
 *
 * The session fill afterwards is the ONE thing the delegated runtime cannot do
 * for these nodes, because it is not an event: a `$session.<field>` marker is
 * RESOLVED INTO the element, and the fresh copy arrives carrying the unresolved
 * template exactly as first load did. Repeating it is safe by construction —
 * the marker stays on the element and keeps holding the template rather than
 * the resolved value — and it is scoped to this region and costs nothing at all
 * on a region that carries no marker.
 */
function swapRegion(swap: RegionSwap): void {
  // eslint-disable-next-line functional/immutable-data, no-param-reassign -- refreshing a region IS a DOM mutation
  swap.live.innerHTML = swap.fresh.innerHTML
  hydrateSessionBindings(swap.live)
}

/**
 * Whether a region holds a MOUNTED island, which makes it untouchable here.
 *
 * Replacing markup out from under a live React root orphans it: its effects and
 * its document-level listeners keep running with no element to render into, and
 * the refreshed region then carries a second live copy of every island inside
 * it. Tearing them down first is what the admin shell's SPA swap does — but the
 * mounter cannot be reached from here, and the reason is worth stating so the
 * next reader does not simply import it.
 *
 * `island-client.tsx` is BOTH the island bundle's entry point and a module that
 * bootstraps with a TOP-LEVEL `await`. This module is in that entry's own eager
 * closure (the fetch executor is reachable from it statically), so importing the
 * mounter — even dynamically — closes an ES-module cycle across that pending
 * await. It does not throw and it logs nothing: the whole page renders with
 * every island un-mounted. Measured here, it failed every data-table criterion
 * in this feature's own spec file while leaving the new one green, which is the
 * signature to recognise. `admin-spa-nav-swap.ts` can dynamically import it only
 * because it lives in a LAZY island chunk, outside that closure.
 *
 * So a region holding a mounted island is LEFT ALONE rather than swapped. That
 * is today's behaviour for it, not a new failure — the nested island re-reads
 * its own rows through `sovrium:refetch` regardless — and it is strictly better
 * than trading a stale list for an orphaned root. The uncovered shape is narrow:
 * a server-rendered bound region whose row template itself mounts an island.
 */
function holdsMountedIsland(region: HTMLElement): boolean {
  return region.querySelector('[data-island]') !== null
}

/**
 * Whether the reader has a destructive question open inside this region.
 *
 * A confirm gate belongs to the reader, not to the region. The vanilla gate a
 * standalone button opens (`confirm-gate-runtime.ts`) is a plain `<div>`
 * inserted after its trigger, so it lives INSIDE the markup this module
 * replaces wholesale — and a write landing anywhere else on the page, naming
 * this region in its `onSuccess.refetch`, used to wipe a half-answered
 * "Delete this account?" and put the trigger back as if the reader had never
 * pressed it. Losing a confirmation that way is worse than reading a list one
 * beat out of date, so the region waits.
 *
 * It waits for one beat only, and never for the reader's OWN answer: confirming
 * removes the dialog before dispatching, so the refresh that follows an answered
 * gate always finds the region clear. What is deferred is only a refresh
 * arriving from somewhere else while the question is still on screen, and the
 * next one after the gate closes brings the region up to date.
 */
function holdsOpenConfirmGate(region: HTMLElement): boolean {
  return region.querySelector('[data-confirm-dialog]') !== null
}

/**
 * Re-read the server-rendered regions among `ids`, if any.
 *
 * Resolves without doing anything when every named id belongs to an island (the
 * ordinary case — the event bus has already served them), when none resolves to
 * an element, or when the re-read fails. A refetch naming several regions costs
 * ONE page read, not one per region.
 *
 * Every failure is silent and leaves the page exactly as it stands: a refresh
 * that cannot happen must not replace a list with an error, since the rows on
 * screen are still the rows the server last sent.
 */
export async function refreshServerRenderedRegions(ids: readonly string[]): Promise<void> {
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') return
  const targets = serverRenderedTargets(ids)
  if (targets.length === 0) return

  const rendered = await fetchRenderedPage()
  if (!rendered) return

  targets.forEach((live) => {
    const fresh = rendered.getElementById(live.id)
    if (fresh) swapRegion({ live, fresh })
  })
}
