/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


const NAVIGATE_EVENT = 'sovrium:admin-navigate'
const NAVIGATED_EVENT = 'sovrium:admin-navigated'

export function navigateAdminSpa(url: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { url } }))
}

export function subscribeAdminNavigate(handler: (url: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<{ readonly url?: string }>
    if (detail?.url) handler(detail.url)
  }
  window.addEventListener(NAVIGATE_EVENT, listener)
  return () => window.removeEventListener(NAVIGATE_EVENT, listener)
}

export function announceAdminNavigated(path: string): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NAVIGATED_EVENT, { detail: { path } }))
}

export function subscribeAdminNavigated(handler: (path: string) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<{ readonly path?: string }>
    if (typeof detail?.path === 'string') handler(detail.path)
  }
  window.addEventListener(NAVIGATED_EVENT, listener)
  return () => window.removeEventListener(NAVIGATED_EVENT, listener)
}
