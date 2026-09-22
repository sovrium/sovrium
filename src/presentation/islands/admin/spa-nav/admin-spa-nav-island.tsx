/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `admin-spa-nav` island — content-only (SPA) navigation for the Native Admin
 * Dashboard shell.
 *
 * Progressive enhancement: the sidebar links stay real `<a href="/_admin/…">`
 * (the page works without JS — a full reload). When mounted, this island
 * intercepts left-clicks on same-origin `/_admin/*` links and swaps ONLY the
 * `#admin-surface-content` region via a content-only partial fetch, keeping the
 * persistent sidebar + ⌘K palette mounted (they live outside the swap region).
 *
 * It also (a) routes ⌘K palette selections through the same swap path (via
 * `subscribeAdminNavigate`), (b) handles browser back/forward by re-fetching +
 * swapping on `popstate` (no pushState), and (c) falls back to a full
 * `window.location.assign` on any non-OK partial or fetch error (SPA-007).
 *
 * Renders nothing — it only wires document/window-level listeners. EAGER-imported
 * so the click interceptor is live before the first nav click.
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { dispatch } from '@/presentation/islands/runtime/event-bus'
import { isWithinMount } from '@/presentation/islands/runtime/mount-base-path'
import { subscribeAdminNavigate } from './admin-spa-nav'
import { performSpaSwap } from './admin-spa-nav-swap'

/** Holds the in-flight nav AbortController so a rapid follow-up nav can cancel it. */
interface NavController {
  current: AbortController | undefined
}

/** Whether a click is a plain left-click (no modifier / new-tab intent). */
function isPlainLeftClick(event: MouseEvent): boolean {
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
 * `pathname` IS the admin path being read — which made it indistinguishable
 * from a navigation to this interceptor, and it was preventDefault'd and
 * re-fetched as a partial. The browser then scrolled nothing.
 *
 * That went unnoticed for as long as no admin page had an in-page anchor. The
 * design-system console's "On this page" rail is the first, because its targets
 * used to live inside an iframe and could not be plain anchors at all;
 * flattening the console made them ordinary fragment links and turned the
 * latent bug into a visible one (`[internal ref]` — following the rail
 * did nothing).
 *
 * `search` is compared as well as `pathname`: `?scheme=dark#tokens` from a page
 * without the parameter is a REAL navigation that happens to carry a fragment,
 * and handing it to the browser would drop the SPA swap.
 */
function isSamePageFragment(anchor: HTMLAnchorElement): boolean {
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
 * navigation to the same URL the address bar never changes. The swap is therefore
 * INVISIBLE while in flight, and a click that lands on the surface before it
 * completes is silently undone: the incoming markup replaces what the reader
 * just did. Crossing a tab strip is the sharp case, because the strip switches
 * panels client-side and the teardown takes its selection AND the nested
 * islands the selection had just mounted, leaving a panel with its labels and
 * no figures.
 *
 * The quiet one is waste: re-fetching a surface and mounting it again to arrive at
 * the surface already rendered is work whose entire output is what was already
 * on screen.
 *
 * So a click on the URL already shown is a no-op, which is what it already means to the reader.
 * The caller still calls `preventDefault` first, so the browser's own reload is
 * stopped too and the reader keeps everything they have done since arriving —
 * a tab selection above all.
 *
 * `hash` is deliberately NOT compared — a same-document fragment link is the
 * separate case {@link isSamePageFragment} handles, and it must keep reaching
 * the browser so the browser can scroll to it.
 */
function isCurrentDocument(anchor: HTMLAnchorElement): boolean {
  return (
    anchor.hash === '' &&
    anchor.pathname === window.location.pathname &&
    anchor.search === window.location.search
  )
}

/** Resolve the in-shell `/_admin/*` anchor a click landed on, if any. */
function resolveAdminAnchor(target: EventTarget | null): HTMLAnchorElement | undefined {
  if (!(target instanceof Element)) return undefined
  const anchor = target.closest('a')
  if (!anchor) return undefined
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return undefined
  if (anchor.origin !== window.location.origin) return undefined
  if (isSamePageFragment(anchor)) return undefined
  // Scoped to the mount serving THIS document, read off the DOM, rather than to
  // a `/_admin` literal compiled into the bundle. The bundle is built before any
  // request and cannot know what served it; asking the document is the only
  // spelling that cannot disagree with the server.
  return isWithinMount(anchor.pathname) ? anchor : undefined
}

/**
 * Drive an SPA navigation: swap content, then `pushState` (or fall back to a
 * full navigation if the partial was unavailable). On `popstate` the caller
 * passes `push: false` so history is not re-pushed.
 *
 * The pushed URL is the FINAL resolved URL the swap reports — which differs from
 * the requested URL when the server 302-redirected the partial (a bare object-page
 * path → its first object, Pass 1 item 1.5a), so the address bar tracks the
 * redirect rather than the bare path.
 */
async function navigate(url: string, push: boolean, controllerRef: NavController): Promise<void> {
  controllerRef.current?.abort()
  const controller = new AbortController()
  // eslint-disable-next-line functional/immutable-data, no-param-reassign -- in-flight controller slot for rapid-click cancellation
  controllerRef.current = controller

  const resolvedUrl = await performSpaSwap(url, controller.signal)
  if (controller.signal.aborted) return
  if (resolvedUrl === undefined) {
    window.location.assign(url)
    return
  }
  if (push) {
    window.history.pushState({ sovriumSpa: true }, '', resolvedUrl)
  }
  // Announce the completed navigation to the mounted chrome — the sidebar above
  // all, which is OUTSIDE the swapped region and therefore still carries the
  // server's mark for the page the reader has already left.
  //
  // AFTER `pushState`, never before: `sovrium:navigated`'s contract is that
  // `window.location` already names the new path when it fires, so subscribers
  // read the address bar rather than a payload that could disagree with it. On
  // the `popstate` path (`push: false`) the browser has already applied the new
  // location, so the same call is correct there too — and harmless, since a
  // subscriber that also listens for `popstate` re-derives the same answer.
  dispatch('sovrium:navigated', { path: window.location.pathname })
}

/** The part of a URL that identifies the DOCUMENT — everything but the fragment. */
const documentUrl = (): string => `${window.location.pathname}${window.location.search}`

/** Wire the global click interceptor, palette-nav listener, and popstate. */
function useSpaNavigation(): void {
  const controllerRef = useRef<NavController>({ current: undefined })
  // The document the shell is currently showing, so a history event that moved
  // only the FRAGMENT can be told from one that moved the page.
  const shownRef = useRef<string>(documentUrl())

  useEffect(() => {
    const controller = controllerRef.current

    const onClick = (event: MouseEvent): void => {
      if (!isPlainLeftClick(event)) return
      const anchor = resolveAdminAnchor(event.target)
      if (!anchor) return
      event.preventDefault()
      if (isCurrentDocument(anchor)) return
      // eslint-disable-next-line functional/immutable-data -- a ref cell is React's own mutable slot
      shownRef.current = `${anchor.pathname}${anchor.search}`
      void navigate(anchor.href, /* push */ true, controller)
    }

    // ─── A FRAGMENT CHANGE IS NOT A NAVIGATION ───────────────────────────
    //
    // Following an in-page `#anchor` is a SAME-DOCUMENT navigation, and the
    // browser fires this event for it. Re-entering `navigate` then re-fetched
    // the page the reader was already on and — via the swap's `scrollTop = 0`
    // — undid the scroll the browser had just performed. Net effect: following
    // the design-system rail put the fragment in the address bar and moved
    // nothing.
    //
    // The click interceptor's own exemption is not enough on its own: it stops
    // the SWAP-on-click, and this event still arrives afterwards. Both halves
    // are needed, and this is the one that also covers the back button moving
    // between two fragments of one page.
    const onPopState = (): void => {
      const target = documentUrl()
      if (target === shownRef.current) return
      // eslint-disable-next-line functional/immutable-data -- a ref cell is React's own mutable slot
      shownRef.current = target
      void navigate(window.location.href, /* push */ false, controller)
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)
    const unsubscribe = subscribeAdminNavigate((url) => {
      const parsed = new URL(url, window.location.href)
      // eslint-disable-next-line functional/immutable-data -- a ref cell is React's own mutable slot
      shownRef.current = `${parsed.pathname}${parsed.search}`
      return navigate(url, /* push */ true, controller)
    })

    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopState)
      unsubscribe()
      controller.current?.abort()
    }
  }, [])
}

/** Admin SPA-nav island — renders nothing; wires content-only navigation. */
export default function AdminSpaNavIsland(): ReactElement | null {
  useSpaNavigation()
  // eslint-disable-next-line unicorn/no-null -- React components must return null to render nothing
  return null
}
