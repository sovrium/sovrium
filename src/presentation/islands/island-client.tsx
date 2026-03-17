/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { ISLANDS } from './island-registry'
import { createIslandQueryClient } from './shared/query-client'

/**
 * Island Client Entry Point
 *
 * Discovers all [data-island] markers in the DOM, creates independent
 * React roots for each, and renders the corresponding island component.
 *
 * Architecture:
 * - Server renders `<div data-island="data-table" data-island-props='{...}'>` with a loading skeleton
 * - This script discovers those markers and mounts React into each
 * - Uses createRoot() (not hydrateRoot) — no hydration mismatch risk
 * - Each island gets its own QueryClient for cache isolation
 * - React.lazy + Suspense ensures island code is loaded on demand
 */

/**
 * Safely parses JSON island props, returns undefined on failure
 */
function parseIslandProps(raw: string | undefined): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return undefined
  }
}

/**
 * Wraps an island component with providers (QueryClient, Suspense)
 */
export function IslandWrapper({
  Component,
  props,
  fallback,
}: {
  readonly Component: React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>
  readonly props: Record<string, unknown>
  readonly fallback: ReactElement
}): ReactElement {
  const [queryClient] = useState(() => createIslandQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    </QueryClientProvider>
  )
}

/**
 * Mounts all islands found in the DOM
 */
function mountIslands(): void {
  const markers = document.querySelectorAll<HTMLElement>('[data-island]')

  markers.forEach((el) => {
    const type = el.dataset.island
    if (!type || !(type in ISLANDS)) return

    const Component = ISLANDS[type]
    if (!Component) return

    // Parse props from data attribute
    const props = parseIslandProps(el.dataset.islandProps)
    if (!props) return

    // Preserve the SSR skeleton as Suspense fallback
    // SECURITY: Safe use of dangerouslySetInnerHTML — fallbackHtml is server-rendered SSR content,
    // not user input. It preserves the skeleton UI while React hydrates the island.
    const fallbackHtml = el.innerHTML
    const fallback = <div dangerouslySetInnerHTML={{ __html: fallbackHtml }} />

    const root = createRoot(el)
    root.render(
      <IslandWrapper
        Component={Component}
        props={props}
        fallback={fallback}
      />
    )
  })
}

// Mount when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountIslands)
} else {
  mountIslands()
}
