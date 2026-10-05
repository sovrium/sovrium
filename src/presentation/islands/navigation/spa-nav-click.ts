/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Click classification for content-only (SPA) navigation: which clicks are a
 * navigation the `spa-nav` island may take over, and which must reach the
 * browser untouched.
 *
 * The filters every scope shares live in {@link resolveNavigableAnchor}; what
 * differs between scopes is only the set of destinations a swap may serve,
 * passed in as a predicate — {@link withinMount} for the operator console,
 * {@link withinApp} for an app's own pages.
 */

import { isWithinMount } from '@/presentation/islands/runtime/mount-base-path'

/** Decides whether a same-origin anchor's destination is one this swap serves. */
export type AcceptsDestination = (url: URL, anchor: HTMLAnchorElement) => boolean

/** Whether a click is a plain left-click (no modifier / new-tab intent). */
export function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  )
}

/**
 * Whether an anchor addresses a fragment of the page it already sits on.
 *
 * ─── WHY THIS EXEMPTION EXISTS ─────────────────────────────────────────────
 *
 * An `href="#some-id"` resolves against the current document, so its
 * `pathname` IS the path being read — which made it indistinguishable from a
 * navigation to the interceptor, and it was preventDefault'd and re-fetched as
 * a partial. The browser then scrolled nothing.
 *
 * That went unnoticed for as long as no console page had an in-page anchor.
 * The design-system console's "On this page" rail is the first, because its
 * targets used to live inside an iframe and could not be plain anchors at all;
 * flattening the console made them ordinary fragment links and turned the
 * latent bug into a visible one (`[internal ref]` — following the rail
 * did nothing).
 *
 * `search` is compared as well as `pathname`: `?scheme=dark#tokens` from a page
 * without the parameter is a REAL navigation that happens to carry a fragment,
 * and handing it to the browser would drop the SPA swap.
 */
export function isSamePageFragment(anchor: HTMLAnchorElement): boolean {
  return (
    anchor.hash !== '' &&
    anchor.pathname === window.location.pathname &&
    anchor.search === window.location.search
  )
}

/**
 * Whether an anchor addresses the document already on screen.
 *
 * ─── WHY A SAME-URL CLICK MUST NOT SWAP ────────────────────────────────────
 *
 * Clicking the sidebar entry for the surface you are already reading is an
 * ordinary gesture, and it used to run a FULL swap: re-fetch the identical
 * partial, unmount every island on the surface, replace the markup, re-mount.
 * Two things followed, both bad.
 *
 * The visible one is a race. A swap ends by pushing its resolved URL, so the
 * address bar is how anything downstream knows the swap landed — and on a
 * navigation to the same URL the address bar never changes. The swap is
 * therefore INVISIBLE while in flight, and a click that lands on the surface
 * before it completes is silently undone: the incoming markup replaces what
 * the reader just did. Crossing a tab strip is the sharp case, because the
 * strip switches panels client-side and the teardown takes its selection AND
 * the nested islands the selection had just mounted, leaving a panel with its
 * labels and no figures.
 *
 * The quiet one is waste: re-fetching a surface and mounting it again to arrive
 * at the surface already rendered is work whose entire output is what was
 * already on screen.
 *
 * So a click on the URL already shown is a no-op, which is what it already
 * means to the reader. The caller still calls `preventDefault` first, so the
 * browser's own reload is stopped too and the reader keeps everything they
 * have done since arriving — a tab selection above all.
 *
 * `hash` is deliberately NOT compared — a same-document fragment link is the
 * separate case {@link isSamePageFragment} handles, and it must keep reaching
 * the browser so the browser can scroll to it.
 */
export function isCurrentDocument(anchor: HTMLAnchorElement): boolean {
  return (
    anchor.hash === '' &&
    anchor.pathname === window.location.pathname &&
    anchor.search === window.location.search
  )
}

/**
 * Resolve the anchor a click landed on, if it is one this swap may take over.
 *
 * Shared by every scope: a new-tab or download anchor, a cross-origin anchor
 * and a same-page fragment always reach the browser. What remains is handed to
 * `accepts`, which decides whether the destination is one this swap serves.
 */
export function resolveNavigableAnchor(
  target: EventTarget | null,
  accepts: AcceptsDestination
): HTMLAnchorElement | undefined {
  if (!(target instanceof Element)) return undefined
  const anchor = target.closest('a')
  if (!anchor) return undefined
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return undefined
  if (anchor.origin !== window.location.origin) return undefined
  if (isSamePageFragment(anchor)) return undefined
  return accepts(new URL(anchor.href), anchor) ? anchor : undefined
}

/**
 * The console's scope: a destination inside the mount serving THIS document.
 *
 * Read off the DOM rather than a `/_admin` literal compiled into the bundle.
 * The bundle is built before any request and cannot know what served it;
 * asking the document is the only spelling that cannot disagree with the
 * server.
 */
export const withinMount: AcceptsDestination = (url) => isWithinMount(url.pathname)

/** Path prefixes an app's page swap never serves: they answer data or files, not pages. */
const NON_PAGE_PREFIXES: readonly string[] = ['/api/', '/assets/']

/**
 * An app's scope: any same-origin page of the app that is NOT the operator
 * console (which runs its own swap over its own shell), NOT an API or asset
 * path, and not an anchor its author opted out with `data-no-spa`.
 */
export const withinApp: AcceptsDestination = (url, anchor) =>
  !isWithinMount(url.pathname) &&
  !NON_PAGE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) &&
  !anchor.hasAttribute('data-no-spa')

/**
 * Page chrome a content swap cannot carry: the record-bound layout sidebar and
 * the presence indicator, both rendered by the page OUTSIDE its main region.
 */
const OUTSIDE_REGION_CHROME = '[data-testid="page-sidebar"], [data-island="presence-indicator"]'

/**
 * Whether the document on screen holds page chrome outside the swapped region.
 *
 * A swap replaces the region only, so leaving such a page by swapping would
 * keep its layout sidebar or its presence channel on a page that declares
 * neither. Its links are therefore left to the browser: the destination loads
 * in full and renders its own chrome — the client half of the rule whose server
 * half declines a partial for a destination that carries such chrome.
 */
export function holdsChromeOutsideRegion(regionId: string): boolean {
  return Array.from(document.querySelectorAll(OUTSIDE_REGION_CHROME)).some(
    (element) => element.closest(`[id="${CSS.escape(regionId)}"]`) === null
  )
}
