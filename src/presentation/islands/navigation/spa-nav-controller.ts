/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The navigation loop of the `spa-nav` island: the document click interceptor,
 * the navigation-request listener, `popstate`, and the swap → history →
 * announcement sequence each of them drives. Split from `spa-nav-island.tsx`
 * to keep the island under the eco `max-lines: 250` cap.
 */

import { useEffect, useRef } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { dispatch } from '@/presentation/islands/runtime/event-bus'
import {
  holdsChromeOutsideRegion,
  isCurrentDocument,
  isPlainLeftClick,
  resolveNavigableAnchor,
  withinApp,
  withinMount,
} from './spa-nav-click'
import { subscribeSpaNavigation } from './spa-nav-request'
import { performSpaSwap, type SpaRegion } from './spa-nav-swap'

/** Holds the in-flight nav AbortController so a rapid follow-up nav can cancel it. */
interface NavController {
  current: AbortController | undefined
}

/** A URL's path, query and fragment when it is on this document's origin. */
const sameOriginPath = (url: string): string | undefined => {
  try {
    const parsed = new URL(url, window.location.href)
    return parsed.origin === window.location.origin
      ? parsed.href.slice(parsed.origin.length)
      : undefined
  } catch {
    return undefined
  }
}

/**
 * Run the full navigation a swap declined: to the URL the server redirected
 * to when it said so, else to the URL that was asked for.
 *
 * Both are same-origin in practice — the click resolver refuses any other
 * origin and a redirect that left it fails the fetch — and the canonical check
 * makes that a guarantee rather than an observation.
 */
const runFullNavigation = (fallbackUrl: string, requestedUrl: string): void => {
  const target = toSafeRedirectPath(sameOriginPath(fallbackUrl) ?? sameOriginPath(requestedUrl))
  if (target !== undefined) window.location.assign(target)
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
async function navigate(
  url: string,
  push: boolean,
  controllerRef: NavController,
  region: SpaRegion
): Promise<void> {
  controllerRef.current?.abort()
  const controller = new AbortController()
  // eslint-disable-next-line functional/immutable-data, no-param-reassign -- in-flight controller slot for rapid-click cancellation
  controllerRef.current = controller

  const outcome = await performSpaSwap(url, region, controller.signal)
  if (controller.signal.aborted) return
  if (!outcome.swapped) {
    runFullNavigation(outcome.fallbackUrl, url)
    return
  }
  if (push) {
    window.history.pushState({ sovriumSpa: true }, '', outcome.url)
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

/** Wire the global click interceptor, navigation-request listener, and popstate. */
export function useSpaNavigation(region: SpaRegion): void {
  const controllerRef = useRef<NavController>({ current: undefined })
  // The document currently shown, so a history event that moved only the
  // FRAGMENT can be told from one that moved the page.
  const shownRef = useRef<string>(documentUrl())
  const { regionId, scope } = region

  useEffect(() => {
    const controller = controllerRef.current
    const target: SpaRegion = { regionId, scope }
    const accepts = scope === 'app' ? withinApp : withinMount

    const onClick = (event: MouseEvent): void => {
      if (!isPlainLeftClick(event)) return
      // An app page carrying chrome outside its region is left by a full load.
      if (scope === 'app' && holdsChromeOutsideRegion(regionId)) return
      const anchor = resolveNavigableAnchor(event.target, accepts)
      if (!anchor) return
      event.preventDefault()
      if (isCurrentDocument(anchor)) return
      // eslint-disable-next-line functional/immutable-data -- a ref cell is React's own mutable slot
      shownRef.current = `${anchor.pathname}${anchor.search}`
      void navigate(anchor.href, /* push */ true, controller, target)
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
      const shown = documentUrl()
      if (shown === shownRef.current) return
      // eslint-disable-next-line functional/immutable-data -- a ref cell is React's own mutable slot
      shownRef.current = shown
      void navigate(window.location.href, /* push */ false, controller, target)
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)
    const unsubscribe = subscribeSpaNavigation((url) => {
      const parsed = new URL(url, window.location.href)
      // eslint-disable-next-line functional/immutable-data -- a ref cell is React's own mutable slot
      shownRef.current = `${parsed.pathname}${parsed.search}`
      return navigate(url, /* push */ true, controller, target)
    })

    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopState)
      unsubscribe()
      controller.current?.abort()
    }
  }, [regionId, scope])
}
