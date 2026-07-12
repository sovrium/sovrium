/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { Suspense, useEffect, useState, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { ISLANDS } from './island-registry'
import { createIslandQueryClient } from './shared/query-client'

const islandRoots = new WeakMap<HTMLElement, Root>()


function parseIslandProps(raw: string | undefined): Record<string, unknown> | undefined {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>
  } catch {
    return undefined
  }
}

function IslandReadySignal({ host }: { readonly host: HTMLElement }): null {
  useEffect(() => {
    host.setAttribute('data-island-ready', 'true')
  }, [host])
  return null
}

export function IslandWrapper({
  Component,
  props,
  fallback,
  host,
}: {
  readonly Component: React.ComponentType<Record<string, unknown>>
  readonly props: Record<string, unknown>
  readonly fallback: ReactElement
  readonly host: HTMLElement
}): ReactElement {
  const [queryClient] = useState(() => createIslandQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={fallback}>
        <Component {...props} />
        <IslandReadySignal host={host} />
      </Suspense>
    </QueryClientProvider>
  )
}

function extractFormValues(el: HTMLElement): Record<string, string> {
  const inputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input[name], textarea[name], select[name]'
  )
  const entries = Array.from(inputs)
    .filter((input) => input.type !== 'hidden' && input.type !== 'file')
    .map((input) => [input.name, input.value] as const)
  return Object.fromEntries(entries)
}

export function mountIslandsWithin(root: ParentNode = document.body): void {
  const markers = root.querySelectorAll<HTMLElement>('[data-island]')

  markers.forEach((el) => {
    if (el.dataset.islandMounted === 'true') return
    const type = el.dataset.island
    if (!type || !(type in ISLANDS)) return

    const Component = ISLANDS[type]
    if (!Component) return
    el.dataset.islandMounted = 'true'

    const props = parseIslandProps(el.dataset.islandProps)
    if (!props) return

    const initialValues = extractFormValues(el)
    const mergedProps = Object.keys(initialValues).length > 0 ? { ...props, initialValues } : props

    const fallbackHtml = el.innerHTML
    const fallback = <div dangerouslySetInnerHTML={{ __html: fallbackHtml }} />

    const root = createRoot(el)
    islandRoots.set(el, root)
    flushSync(() => {
      root.render(
        <IslandWrapper
          Component={Component}
          props={mergedProps}
          fallback={fallback}
          host={el}
        />
      )
    })

  })
}

export function unmountIslandsWithin(root: ParentNode = document.body): void {
  const markers = root.querySelectorAll<HTMLElement>('[data-island]')
  markers.forEach((el) => {
    const mounted = islandRoots.get(el)
    if (mounted) {
      mounted.unmount()
      islandRoots.delete(el)
    }
    delete el.dataset.islandMounted
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountIslandsWithin())
} else {
  mountIslandsWithin()
}
