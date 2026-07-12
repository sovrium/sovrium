/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useEffect, useRef, type ReactElement } from 'react'
import { subscribeAdminNavigate } from './admin-spa-nav'
import { performSpaSwap } from './admin-spa-nav-swap'

interface NavController {
  current: AbortController | undefined
}

const ADMIN_PREFIX = '/_admin'

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

function resolveAdminAnchor(target: EventTarget | null): HTMLAnchorElement | undefined {
  if (!(target instanceof Element)) return undefined
  const anchor = target.closest('a')
  if (!anchor) return undefined
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return undefined
  if (anchor.origin !== window.location.origin) return undefined
  return anchor.pathname.startsWith(ADMIN_PREFIX) ? anchor : undefined
}

async function navigate(url: string, push: boolean, controllerRef: NavController): Promise<void> {
  controllerRef.current?.abort()
  const controller = new AbortController()
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

function useSpaNavigation(): void {
  const controllerRef = useRef<NavController>({ current: undefined })

  useEffect(() => {
    const controller = controllerRef.current

    const onClick = (event: MouseEvent): void => {
      if (!isPlainLeftClick(event)) return
      const anchor = resolveAdminAnchor(event.target)
      if (!anchor) return
      event.preventDefault()
      void navigate(anchor.href, true, controller)
    }

    const onPopState = (): void => {
      void navigate(window.location.href, false, controller)
    }

    document.addEventListener('click', onClick)
    window.addEventListener('popstate', onPopState)
    const unsubscribe = subscribeAdminNavigate((url) => navigate(url, true, controller))

    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('popstate', onPopState)
      unsubscribe()
      controller.current?.abort()
    }
  }, [])
}

export default function AdminSpaNavIsland(): ReactElement | null {
  useSpaNavigation()
  return null
}
