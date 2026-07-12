/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { mountIslandsWithin, unmountIslandsWithin } from '@/presentation/islands/island-client'
import { announceAdminNavigated } from './admin-spa-nav'

const CONTENT_ID = 'admin-surface-content'

function toActivePath(pathname: string): string {
  return pathname.replace(/^\/_admin/, '') || '/'
}

export async function performSpaSwap(
  url: string,
  signal?: AbortSignal
): Promise<string | undefined> {
  const content = document.getElementById(CONTENT_ID)
  if (!content) return undefined

  let html: string
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

  unmountIslandsWithin(content)
  content.innerHTML = html
  mountIslandsWithin(content)

  announceAdminNavigated(toActivePath(new URL(resolvedUrl, window.location.origin).pathname))
  content.setAttribute('tabindex', '-1')
  content.focus({ preventScroll: true })
  content.scrollTop = 0
  return resolvedUrl
}
