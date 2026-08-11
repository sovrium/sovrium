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
import { subscribeAdminNavigate } from './admin-spa-nav'
import { performSpaSwap } from './admin-spa-nav-swap'

/** Holds the in-flight nav AbortController so a rapid follow-up nav can cancel it. */
interface NavController {
  current: AbortController | undefined
}

/** The dashboard route prefix the interceptor scopes to. */
const ADMIN_PREFIX = '/_admin'

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

/** Resolve the in-shell `/_admin/*` anchor a click landed on, if any. */
function resolveAdminAnchor(target: EventTarget | null): HTMLAnchorElement | undefined {
  if (!(target instanceof Element)) return undefined
  const anchor = target.closest('a')
  if (!anchor) return undefined
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return undefined
  if (anchor.origin !== window.location.origin) return undefined
  return anchor.pathname.startsWith(ADMIN_PREFIX) ? anchor : undefined
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
}

/** Wire the global click interceptor, palette-nav listener, and popstate. */
function useSpaNavigation(): void {
  const controllerRef = useRef<NavController>({ current: undefined })

  useEffect(() => {
    const controller = controllerRef.current

    const onClick = (event: MouseEvent): void => {
      if (!isPlainLeftClick(event)) return
      const anchor = resolveAdminAnchor(event.target)
      if (!anchor) return
      event.preventDefault()
      void navigate(anchor.href, /* push */ true, controller)
    }

    const onPopState = (): void => {
      void navigate(window.location.href, /* push */ false, controller)
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)
    const unsubscribe = subscribeAdminNavigate((url) => navigate(url, /* push */ true, controller))

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
