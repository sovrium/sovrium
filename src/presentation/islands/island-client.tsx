/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { Suspense, type ReactElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { ISLANDS, PRIORITY_ISLAND_LOADERS } from './island-registry'
import { IslandReadySignal } from './runtime/island-ready-signal'
import {
  replayPendingFiles,
  capturePendingFocus,
  restorePendingFocus,
  capturePreMountInput,
} from './runtime/pre-mount-input'
import {
  getPageQueryClient,
  staleInactivePageQueries as staleInactivePageQueryCache,
} from './runtime/query-client'
import { reloadOnceForStaleChunk } from './runtime/stale-chunk-reload'

/**
 * Island Client Entry Point
 *
 * Discovers all [data-island] markers in the DOM, creates independent
 * React roots for each, and renders the corresponding island component.
 *
 * Architecture:
 * - Server renders `<div data-island="table" data-island-props='{...}'>` with a loading skeleton
 * - This script discovers those markers and mounts React into each
 * - Uses createRoot() (not hydrateRoot) — no hydration mismatch risk
 * - Every island shares the page's one QueryClient, so identical reads are sent
 *   once and a write made through one island refreshes the others showing it
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
 * Priority islands whose loader has already resolved, keyed by island type.
 *
 * {@link mountIslandsWithin} prefers this over {@link ISLANDS}: a component
 * found here renders on the FIRST commit, inside the same `flushSync` that
 * creates the root, so it owns its events before the user's (or the spec's)
 * first gesture. A component reached through `ISLANDS` renders one Suspense
 * boundary later, with the SSR skeleton visible in between.
 *
 * That difference is the entire reason fourteen islands used to be static
 * imports of the entry module — and why twelve of them no longer need to be.
 * The two that still are, and why preloading is not enough for them, are named
 * in `island-registry.ts` along with the measurements.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
const resolvedPriorityIslands = new Map<string, React.ComponentType<any>>()

/**
 * In-flight priority loads, keyed by island type.
 *
 * Two concurrent scans of overlapping subtrees (the first-load pass and a tabs
 * panel committing during it) must not start the same `import()` twice, and
 * must not race to a half-populated {@link resolvedPriorityIslands}. Holding the
 * promise makes the second caller await the first caller's load.
 */
const inFlightPriorityLoads = new Map<string, Promise<void>>()

/**
 * Resolve every PRIORITY island whose marker is present in `root`, so the mount
 * pass that follows can commit those components synchronously.
 *
 * Scoped to the markers actually in the DOM — that scoping is the whole point.
 * The alternative shape, "resolve every priority island", would reproduce the
 * defect this replaced (223 KB and 32 requests of islands the page does not
 * mount, measured 2026-09-01) with an extra round trip on top.
 *
 * Never rejects: a chunk that fails to load leaves its type absent from
 * {@link resolvedPriorityIslands}, and {@link mountIslandsWithin} falls back to
 * the `ISLANDS` Suspense path — degraded (the SSR skeleton stays up longer)
 * rather than a bootstrap that throws and mounts NOTHING on the page. A chunk
 * that could not be FETCHED is the mark of an entry from a previous release,
 * so it also triggers the once-per-tab recovery reload (see
 * `runtime/stale-chunk-reload.ts`).
 *
 * @param root - the subtree to scan (defaults to `document.body`)
 */
// eslint-disable-next-line react-refresh/only-export-components -- island bootstrap entry, not a fast-refresh component module
export async function preloadIslandsWithin(root: ParentNode = document.body): Promise<void> {
  const present = new Set(
    Array.from(root.querySelectorAll<HTMLElement>('[data-island]'))
      .map((el) => el.dataset.island)
      .filter((type): type is string => type !== undefined)
  )

  const pending = Array.from(present)
    .filter((type) => !resolvedPriorityIslands.has(type))
    .map((type) => {
      const started = inFlightPriorityLoads.get(type)
      if (started) return started
      const loader = PRIORITY_ISLAND_LOADERS[type]
      if (!loader) return undefined
      const load = loader()
        .then((module) => {
          resolvedPriorityIslands.set(type, module.default)
        })
        .catch((error: unknown) => {
          // Swallowed deliberately — see the "never rejects" note above.
          reloadOnceForStaleChunk(error)
        })
      inFlightPriorityLoads.set(type, load)
      return load
    })
    .filter((load): load is Promise<void> => load !== undefined)

  await Promise.all(pending)
}

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

/** The Suspense fallback's wrapper lays out as if absent — see {@link ssrFallback}. */
const FALLBACK_WRAPPER_STYLE = { display: 'contents' } as const

/**
 * The SSR skeleton kept on screen while an island's chunk loads.
 *
 * The wrapper takes no box of its own (`display: contents`), so the SSR
 * children keep laying out against the host — a host that stacks its items
 * (`flex-col`) still stacks them while the chunk loads, instead of reflowing
 * them inline under an unstyled wrapper.
 *
 * SECURITY: safe use of `dangerouslySetInnerHTML` — the markup is the host's own
 * server-rendered content, not user input.
 */
function ssrFallback(html: string): ReactElement {
  return (
    <div
      style={FALLBACK_WRAPPER_STYLE}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time Suspense fallback constructed during island mount; never re-renders
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Wraps an island component with providers (the page's shared QueryClient,
 * Suspense)
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
  return (
    <QueryClientProvider client={getPageQueryClient()}>
      <Suspense fallback={fallback}>
        <Component {...props} />
        <IslandReadySignal host={host} />
      </Suspense>
    </QueryClientProvider>
  )
}

/**
 * The component to render for a marker type.
 *
 * A priority island already resolved by {@link preloadIslandsWithin} renders on
 * the FIRST commit — inside the mounter's `flushSync`, so it owns its events
 * immediately. Everything else falls back to the type's `React.lazy`, which
 * renders one Suspense boundary later with the SSR skeleton visible in between.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Island props vary by type
function componentFor(type: string): React.ComponentType<any> | undefined {
  return resolvedPriorityIslands.get(type) ?? ISLANDS[type]
}

/**
 * A lazy island whose chunk cannot be fetched rejects inside its Suspense
 * boundary and surfaces here, as the root's uncaught error. A failed FETCH means
 * the page runs an entry from a previous release, so it gets the once-per-tab
 * recovery reload; anything else is reported exactly as React's default would.
 */
function onIslandUncaughtError(error: unknown): void {
  if (!reloadOnceForStaleChunk(error)) globalThis.reportError(error)
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
 * ─── A MARKER THIS SCAN ITSELF DETACHED IS SKIPPED ─────────────────────────
 *
 * `querySelectorAll` hands back a STATIC list, so an island whose host sits
 * inside another island's server-rendered subtree is still in it after that
 * outer island's `createRoot` discarded the subtree. Mounting it there would
 * build a live React root — and fire its data reads — against a node nobody can
 * see. The tabs island is the case this exists for: the panel a URL addresses is
 * server-rendered in full now, nested island markers included
 *, and the tabs island re-injects that markup and mounts
 * the marker inside its own panel a moment later. Skipping it here is what makes
 * that ONE mount instead of two — the collision that used to be avoided by not
 * rendering such a panel at all.
 *
 * The test is conditioned on `scanIsLive` because a marker going missing only
 * MEANS anything when the scan started from live DOM. A caller that deliberately
 * mounts into an off-document subtree — building a surface before inserting it —
 * has every marker disconnected from the first one, and must not be read as
 * having lost them.
 *
 * @param root - the subtree to scan (defaults to `document.body`)
 */
// eslint-disable-next-line react-refresh/only-export-components -- island bootstrap entry, not a fast-refresh component module; this is the shared island mounter
export function mountIslandsWithin(root: ParentNode = document.body): void {
  const markers = root.querySelectorAll<HTMLElement>('[data-island]')
  const scanIsLive = root.isConnected

  markers.forEach((el) => {
    if (el.dataset.islandMounted === 'true') return
    if (scanIsLive && !el.isConnected) return
    const type = el.dataset.island
    if (!type || !(type in ISLANDS)) return
    const Component = componentFor(type)
    if (!Component) return
    // eslint-disable-next-line no-param-reassign -- idempotency flag prevents a double-mount on a re-scan
    el.dataset.islandMounted = 'true'

    // Parse props from data attribute
    const props = parseIslandProps(el.dataset.islandProps)
    if (!props) return

    const { mergedProps, pendingFiles } = capturePreMountInput(el, props)
    const pendingFocus = capturePendingFocus(el)

    // Preserve the SSR skeleton as Suspense fallback
    const fallback = ssrFallback(el.innerHTML)

    const root = createRoot(el, { onUncaughtError: onIslandUncaughtError })
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

    // …which is also the signal the file replay waits for, so it must be armed
    // after the render that can set it.
    if (pendingFiles.length > 0) replayPendingFiles(el, pendingFiles)
    if (pendingFocus) restorePendingFocus(el, pendingFocus)
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
  unmountIslandHosts(root.querySelectorAll<HTMLElement>('[data-island]'))
}

/**
 * Mark the page's cached answers no mounted island reads as stale. Called by a
 * client-side navigation right after it unmounts the outgoing surface, so a
 * surface revisited remounts from its cached answers and refreshes them in the
 * background (see `staleInactivePageQueries` in `runtime/query-client.ts`).
 */
// eslint-disable-next-line react-refresh/only-export-components -- island bootstrap entry, not a fast-refresh component module
export function staleInactivePageQueries(): void {
  staleInactivePageQueryCache()
}

/**
 * Unmounts the island mounted on each of `hosts`, if any, and clears its
 * `data-island-mounted` flag. The per-host half of {@link unmountIslandsWithin},
 * for a caller holding hosts that are no longer under any root it could scan —
 * a tab panel Base UI removed from the document leaves its islands' roots alive
 * on the detached nodes, and only the hosts themselves still name them.
 */
// eslint-disable-next-line react-refresh/only-export-components -- island bootstrap entry, not a fast-refresh component module; this is the shared island unmounter
export function unmountIslandHosts(hosts: Iterable<HTMLElement>): void {
  Array.from(hosts).forEach((el) => {
    const mounted = islandRoots.get(el)
    if (mounted) {
      mounted.unmount()
      islandRoots.delete(el)
    }
    // eslint-disable-next-line no-param-reassign -- clearing the idempotency flag mirrors the unmount so a surviving element can re-mount
    delete el.dataset.islandMounted
  })
}

/**
 * Resolve this page's priority islands, then mount everything.
 *
 * The order is what preserves the guarantee the removed static imports used to
 * buy: by the time `mountIslandsWithin` runs, every priority island the page
 * declares is a real component, so `flushSync` commits it before the SSR
 * skeleton can field an event.
 */
const bootstrap = async (): Promise<void> => {
  await preloadIslandsWithin()
  mountIslandsWithin()
}

// This module is served as `<script type="module">`, which is deferred, so
// `readyState` is past `loading` by the time it evaluates and the top-level
// `await` below is the live path. It is deliberate: it sequences the preload
// ahead of the mount without pushing either into a later task.
//
// Measured, so nobody re-derives it: this does NOT hold back `load`. When the
// preload has nothing to fetch it settles in a microtask and the mount lands
// before `load`; when it awaits a real chunk, `load` fires first and the island
// mounts just after. That is why `crud-form` and `auth-form` are still static
// imports in `island-registry.ts` — `page.goto()` returns on `load`, and their
// SSR skeletons swallow the next gesture.
//
// The `loading` branch must NOT await: a deferred script runs BEFORE
// `DOMContentLoaded`, so awaiting that event from inside one would deadlock the
// module against an event it is itself blocking. It stays a callback.
//
// A module reached from a priority loader must not STATICALLY import this file
// — see the hazard note in `island-registry.ts`.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap())
} else {
  await bootstrap()
}
