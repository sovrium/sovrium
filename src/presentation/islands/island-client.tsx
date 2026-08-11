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

/**
 * The live React root for each mounted island host, keyed by its host element.
 *
 * An island's `createRoot` root is NOT auto-unmounted when its host element
 * leaves the DOM (e.g. the admin SPA content swap replaces `innerHTML`). The
 * orphaned root keeps its effects alive — most consequentially its `document`-
 * level cross-island event listeners (`sovrium:open-drawer` etc.) and its
 * Dialog/portal subtree rendered into `document.body`. Tracking the root here
 * lets {@link unmountIslandsWithin} tear it down BEFORE the swap so a re-rendered
 * surface does not accumulate duplicate, still-listening island instances (which
 * would, e.g., open two record-detail drawers on a single row click).
 */
const islandRoots = new WeakMap<HTMLElement, Root>()

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
 * Signals to the test harness (and any other observer) that the island has
 * actually mounted — i.e. the lazy chunk has resolved, the real Component has
 * rendered, and the Suspense boundary has settled. Rendered as a sibling of
 * `<Component>` INSIDE `<Suspense>` so its `useEffect` only commits after the
 * lazy import completes; while Suspense is still showing the SSR-skeleton
 * fallback, the effect does not run and `data-island-ready` is NOT set.
 *
 * Why this matters: the previous synchronous `host.setAttribute(...)` call
 * immediately after `flushSync` fired before lazy chunks resolved, so any
 * `[data-island-ready]` gate (E2E specs reading computed styles, etc.)
 * unblocked against the still-mounted SSR skeleton — race window where
 * `getComputedStyle()` returned empty/transparent paint.
 */
function IslandReadySignal({ host }: { readonly host: HTMLElement }): null {
  useEffect(() => {
    host.setAttribute('data-island-ready', 'true')
  }, [host])
  // eslint-disable-next-line unicorn/no-null -- React components must return null (not undefined) to render nothing
  return null
}

/**
 * Wraps an island component with providers (QueryClient, Suspense)
 */
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

/**
 * Extracts current form input values from the SSR skeleton.
 * Preserves values entered by the user before the island mounts.
 */
function extractFormValues(el: HTMLElement): Record<string, string> {
  const inputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input[name], textarea[name], select[name]'
  )
  const entries = Array.from(inputs)
    // Skip hidden inputs and file inputs. A file `<input>`'s `.value` is
    // always an empty/opaque string (browsers forbid reading it), so capturing
    // it here would clobber the record's existing attachment metadata in edit
    // mode (FORM-037) — `buildInitialValues` lets a captured value win over the
    // record, and `'' ?? record` keeps the empty string.
    .filter((input) => input.type !== 'hidden' && input.type !== 'file')
    .map((input) => [input.name, input.value] as const)
  return Object.fromEntries(entries)
}

/**
 * Mounts every island marker found within `root` (inclusive of `root`'s own
 * subtree). Idempotent: a marker already mounted (flagged with
 * `data-island-mounted`) is skipped, so this is safe to call repeatedly — e.g.
 * the initial whole-document pass AND a later pass over a subtree that was
 * injected after load (the tabs island injects its active panel's SSR HTML via
 * `dangerouslySetInnerHTML`, so its nested `data-island` markers — a split-pane
 * editor, a data-table — are not present at first-load scan time and must be
 * mounted when the panel commits).
 *
 * Captures any form values entered in the SSR skeleton before replacement to
 * preserve user input across the hydration boundary.
 *
 * @param root - the subtree to scan (defaults to `document.body`)
 */
// eslint-disable-next-line react-refresh/only-export-components -- island bootstrap entry, not a fast-refresh component module; this is the shared island mounter
export function mountIslandsWithin(root: ParentNode = document.body): void {
  const markers = root.querySelectorAll<HTMLElement>('[data-island]')

  markers.forEach((el) => {
    if (el.dataset.islandMounted === 'true') return
    const type = el.dataset.island
    if (!type || !(type in ISLANDS)) return

    const Component = ISLANDS[type]
    if (!Component) return
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- idempotency flag prevents a double-mount on a re-scan
    el.dataset.islandMounted = 'true'

    // Parse props from data attribute
    const props = parseIslandProps(el.dataset.islandProps)
    if (!props) return

    // Capture form values entered before island hydration. In create mode this
    // preserves typing into the empty SSR skeleton; in update mode the SSR
    // skeleton is pre-filled with the record's current values, so extracting
    // is a no-op for untouched fields and correctly carries over any value the
    // user typed against the skeleton between SSR delivery and React mount
    // (otherwise that keystroke is lost when React re-renders from `record`,
    // and a downstream auto-save sees no diff against the original).
    const initialValues = extractFormValues(el)
    const mergedProps = Object.keys(initialValues).length > 0 ? { ...props, initialValues } : props

    // Preserve the SSR skeleton as Suspense fallback
    // SECURITY: Safe use of dangerouslySetInnerHTML — fallbackHtml is server-rendered SSR content,
    // not user input. It preserves the skeleton UI while React hydrates the island.
    const fallbackHtml = el.innerHTML
    // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time Suspense fallback constructed during island mount; never re-renders
    const fallback = <div dangerouslySetInnerHTML={{ __html: fallbackHtml }} />

    const root = createRoot(el)
    // Track the root so `unmountIslandsWithin` can tear it down on an SPA swap.
    islandRoots.set(el, root)
    // `flushSync` is retained so that eagerly-imported islands (auth-form,
    // crud-form, ai-chat per `island-registry.ts`) take over event handling
    // before the user can type into the SSR skeleton. For lazy-imported
    // islands this only commits the Suspense fallback synchronously — the
    // real Component mounts asynchronously once the lazy chunk loads.
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

    // Note: `data-island-ready` is set by <IslandReadySignal> INSIDE the
    // Suspense boundary once the lazy chunk has resolved + the real Component
    // has mounted. Setting it synchronously here would fire while the SSR
    // skeleton is still rendering (lazy-import case), breaking tests that gate
    // computed-style reads on the signal.
  })
}

/**
 * Unmounts every mounted island within `root` (used before an SPA content swap
 * replaces `root.innerHTML`). For each tracked host this calls `root.unmount()`,
 * which runs the islands' effect cleanups (removing their `document`-level
 * cross-island event listeners) and tears down any body-portalled dialog
 * subtree — so the next surface render does not accumulate a second, still-
 * listening copy of the island (the cause of the duplicate record-detail drawer
 * on a post-swap row click). The host's `data-island-mounted` flag is cleared so
 * the element could be re-mounted if it somehow survives the swap (defensive —
 * the `innerHTML` replacement normally discards it).
 *
 * @param root - the subtree whose island markers to unmount (defaults to `document.body`)
 */
// eslint-disable-next-line react-refresh/only-export-components -- island bootstrap entry, not a fast-refresh component module; this is the shared island unmounter
export function unmountIslandsWithin(root: ParentNode = document.body): void {
  const markers = root.querySelectorAll<HTMLElement>('[data-island]')
  markers.forEach((el) => {
    const mounted = islandRoots.get(el)
    if (mounted) {
      mounted.unmount()
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- WeakMap.delete, not a Drizzle query builder
      islandRoots.delete(el)
    }
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- clearing the idempotency flag mirrors the unmount so a surviving element can re-mount
    delete el.dataset.islandMounted
  })
}

// Mount when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountIslandsWithin())
} else {
  mountIslandsWithin()
}
