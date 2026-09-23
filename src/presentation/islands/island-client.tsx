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
import { ISLANDS, PRIORITY_ISLAND_LOADERS } from './island-registry'
import { createIslandQueryClient } from './runtime/query-client'

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
 * rather than a bootstrap that throws and mounts NOTHING on the page.
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
          // eslint-disable-next-line functional/immutable-data -- the resolved-component cache IS the memo this function exists to fill
          resolvedPriorityIslands.set(type, module.default)
        })
        .catch(() => {
          // Swallowed deliberately — see the "never rejects" note above.
        })
      // eslint-disable-next-line functional/immutable-data -- in-flight registry; recorded before the await so a concurrent scan joins this load instead of starting a second one
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
 * Writes the LIVE state of every form control in `el` back into its MARKUP.
 *
 * `innerHTML` serialises ATTRIBUTES, and a value someone has typed lives in the
 * `value` PROPERTY — the attribute still says whatever the server rendered. Two
 * captures read `el.innerHTML`: the Suspense fallback built in
 * {@link mountIslandsWithin}, and the `ssrHtml` an island keeps by declaring
 * `data-island-ssr`. Both are re-inserted into the document, so both used to
 * hand back a copy of the page with every entered value reverted — silently,
 * with nothing thrown and nothing logged.
 *
 * The case that exposed it is a record form inside a tab panel. The tabs island
 * captures its panel as markup and re-inserts it, and the form island then
 * mounts against that copy; a name typed before the islands mounted was
 * serialised away, so the form posted the value the page had loaded with. The
 * record was saved unchanged and the edit simply disappeared.
 *
 * Mutating a subtree `createRoot` is about to discard is safe by construction:
 * all this does is make the serialisation say what is on screen. File inputs
 * are skipped — a selection cannot be written as an attribute, and travels
 * separately through {@link extractPendingFiles}.
 */
function inlineLiveFormState(el: HTMLElement): void {
  el.querySelectorAll('input').forEach((input) => {
    if (input.type === 'file') return
    if (input.type === 'checkbox' || input.type === 'radio') {
      input.toggleAttribute('checked', input.checked)
      return
    }
    input.setAttribute('value', input.value)
  })
  // A `<textarea>` has no `value` attribute at all: its markup CONTENT is the
  // value, so the text node is what has to be replaced.
  el.querySelectorAll('textarea').forEach((area) => {
    area.replaceChildren(document.createTextNode(area.value))
  })
  el.querySelectorAll('option').forEach((option) => {
    option.toggleAttribute('selected', option.selected)
  })
}

/**
 * A file the user picked against the SSR skeleton, before the island mounted.
 *
 * The twin of {@link extractFormValues} for the one input type that hook
 * cannot carry: a file `<input>`'s `.value` is opaque, but its `.files`
 * `FileList` is readable and holds the whole selection.
 */
interface PendingFileSelection {
  readonly name: string
  readonly files: FileList
}

/**
 * Collects file selections made against the SSR skeleton before mount.
 *
 * `createRoot` (not `hydrateRoot`) DISCARDS the server-rendered subtree, so a
 * file picked between SSR delivery and React mount dies with the node that
 * held it: no change handler ever ran, no upload fired, and the input React
 * renders in its place is empty. On a slow connection — or when the island
 * chunk is built at request time — that window is seconds wide, and the user
 * watches their chosen file silently vanish.
 */
function extractPendingFiles(el: HTMLElement): readonly PendingFileSelection[] {
  const inputs = el.querySelectorAll<HTMLInputElement>('input[type="file"][name]')
  return Array.from(inputs)
    .filter((input) => (input.files?.length ?? 0) > 0)
    .map((input) => ({ name: input.name, files: input.files as FileList }))
}

/** How long to wait for a lazy island's real component before abandoning the replay. */
const PENDING_FILE_REPLAY_TIMEOUT_MS = 30_000

/**
 * Re-applies a pre-mount file selection to the input React just rendered, then
 * dispatches the `change` the skeleton's input could not deliver — so the
 * island's own validate → upload → preview path runs exactly as if the file
 * had been picked a moment later.
 *
 * Replayed exactly ONCE per host, gated on `data-island-ready` — the signal
 * {@link IslandReadySignal} sets when the REAL component has mounted. Gating on
 * anything earlier would apply the files to the Suspense fallback, which is
 * inert server-rendered HTML carrying no React listener, and the selection
 * would be lost a second time when the real component replaced it. Firing once
 * is also what stops a double upload: the file field remounts its input under
 * a fresh `key` after a successful upload, and a re-arming observer would read
 * that deliberately empty input as a second chance to replay.
 */
function replayPendingFiles(el: HTMLElement, pending: readonly PendingFileSelection[]): void {
  const apply = () => {
    pending.forEach(({ name, files }) => {
      const input = el.querySelector<HTMLInputElement>(
        `input[type="file"][name="${CSS.escape(name)}"]`
      )
      // A selection already present is the user's own, made after mount —
      // never overwrite it with the stale skeleton pick.
      if (!input || (input.files?.length ?? 0) > 0) return
      // eslint-disable-next-line functional/immutable-data -- `HTMLInputElement.files` is settable by spec; assigning it is the only way to restore a selection onto the node React just created
      input.files = files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  if (el.dataset.islandReady === 'true') {
    apply()
    return
  }

  const observer = new MutationObserver(() => {
    if (el.dataset.islandReady !== 'true') return
    observer.disconnect()
    apply()
  })
  observer.observe(el, { attributes: true, attributeFilter: ['data-island-ready'] })
  setTimeout(() => observer.disconnect(), PENDING_FILE_REPLAY_TIMEOUT_MS)
}

/**
 * Everything the user put into the SSR skeleton that must survive the mount.
 *
 * `createRoot` discards the server-rendered subtree, so anything typed or
 * picked between SSR delivery and React mount is lost unless it is read out
 * first. Text/select values ride across as the `initialValues` prop; a file
 * selection cannot (a `FileList` is not JSON) and is replayed onto the mounted
 * input instead.
 *
 * In create mode `initialValues` preserves typing into the empty skeleton; in
 * update mode the skeleton is pre-filled with the record's current values, so
 * extracting is a no-op for untouched fields and correctly carries over any
 * value the user typed between SSR delivery and React mount (otherwise that
 * keystroke is lost when React re-renders from `record`, and a downstream
 * auto-save sees no diff against the original).
 *
 * The third thing an island can ask to keep is the SERVER-RENDERED MARKUP
 * itself, by declaring `data-island-ssr="true"` on its host. An island that
 * does so is telling the mounter that the document — not its serialised props —
 * is where some of its content lives, so shipping that content twice can stop.
 * The tabs island is the first: the panel a URL addresses is real markup in the
 * page, and serialising it again into `data-island-props` cost the response a
 * whole second escaped copy of its largest panel. The
 * read has to happen HERE because `createRoot` discards the server-rendered
 * subtree on its first commit, and no code inside the island runs before that.
 * Nothing is captured for a host that does not opt in.
 */
function capturePreMountInput(
  el: HTMLElement,
  props: Record<string, unknown>
): {
  readonly mergedProps: Record<string, unknown>
  readonly pendingFiles: readonly PendingFileSelection[]
} {
  // Ahead of BOTH markup captures — the `ssrHtml` below, and the Suspense
  // fallback `mountIslandsWithin` reads off the same element a moment later.
  inlineLiveFormState(el)
  const initialValues = extractFormValues(el)
  const withValues = Object.keys(initialValues).length > 0 ? { ...props, initialValues } : props
  return {
    mergedProps:
      el.dataset.islandSsr === 'true' ? { ...withValues, ssrHtml: el.innerHTML } : withValues,
    pendingFiles: extractPendingFiles(el),
  }
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
    // eslint-disable-next-line functional/immutable-data, no-param-reassign -- idempotency flag prevents a double-mount on a re-scan
    el.dataset.islandMounted = 'true'

    // Parse props from data attribute
    const props = parseIslandProps(el.dataset.islandProps)
    if (!props) return

    const { mergedProps, pendingFiles } = capturePreMountInput(el, props)

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

    // …which is also the signal the file replay waits for, so it must be armed
    // after the render that can set it.
    if (pendingFiles.length > 0) replayPendingFiles(el, pendingFiles)
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
