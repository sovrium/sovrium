/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useState, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ISLANDS } from './island-registry'
import { createIslandQueryClient } from './shared/query-client'


function parseIslandProps(raw: string | undefined): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return undefined
  }
}

export function IslandWrapper({
  Component,
  props,
  fallback,
}: {
  readonly Component: React.ComponentType<Record<string, unknown>>
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

function extractFormValues(el: HTMLElement): Record<string, string> {
  const inputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input[name], textarea[name], select[name]'
  )
  const entries = Array.from(inputs)
    .filter((input) => input.type !== 'hidden')
    .map((input) => [input.name, input.value] as const)
  return Object.fromEntries(entries)
}

function mountIslands(): void {
  const markers = document.querySelectorAll<HTMLElement>('[data-island]')

  markers.forEach((el) => {
    const type = el.dataset.island
    if (!type || !(type in ISLANDS)) return

    const Component = ISLANDS[type]
    if (!Component) return

    const props = parseIslandProps(el.dataset.islandProps)
    if (!props) return

    const hasServerData = (props as Record<string, unknown>).record !== undefined
    const initialValues = hasServerData ? {} : extractFormValues(el)
    const mergedProps = Object.keys(initialValues).length > 0 ? { ...props, initialValues } : props

    const fallbackHtml = el.innerHTML
    const fallback = <div dangerouslySetInnerHTML={{ __html: fallbackHtml }} />

    const root = createRoot(el)
    flushSync(() => {
      root.render(
        <IslandWrapper
          Component={Component}
          props={mergedProps}
          fallback={fallback}
        />
      )
    })

    el.setAttribute('data-island-ready', 'true')
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountIslands)
} else {
  mountIslands()
}
