/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bring server-rendered markup to life inside an island that injects it on the
 * client — a dialog, drawer or popover body, which does not exist until it
 * opens, or a scroll area's content, which the island re-renders in place.
 *
 * Markup placed with `innerHTML` (or `dangerouslySetInnerHTML`) is inert in two
 * ways, and a form inside it breaks through both:
 *
 *  1. Island markers it carries are never mounted. The page's first-load pass
 *     ran before the markup existed, so a `crud-form` marker stays a bare
 *     `<form>` and the browser submits it natively (a GET to the current URL).
 *  2. `<script>` elements it carries never execute — the HTML parser marks
 *     scripts inserted through `innerHTML` as already started. An embedded
 *     `formRef` form ships its submit runtime as exactly such a script, so its
 *     native `method="POST"` navigates the document instead.
 *
 * {@link useLiveInjectedMarkup} owns the container's children imperatively
 * (React 19 re-applies `dangerouslySetInnerHTML` on every re-render, which would
 * tear out a mounted island root), re-creates each executable script so the
 * browser runs it once, and mounts the nested islands. The cleanup unmounts
 * those islands, so a surface that is closed and reopened never keeps a second
 * live copy of a form.
 *
 * {@link mountNestedIslands} is the mount half on its own, for the islands that
 * inject their markup some other way but still owe its markers a mount and an
 * unmount: the record drawer's composed slot and the tabs island's panels. The
 * tabs island also owes its panels' scripts a run, so {@link runInjectedScripts}
 * is exported for it. It
 * lives here, in a component-type directory, rather than a tier below: it has
 * to reach `island-client`, which no tier may import.
 *
 * SECURITY: the markup is server-rendered from the app's own configuration, not
 * user input — the same trust every host island (dialog, drawer, popover, scroll
 * area) already extends to it. Re-running its scripts grants nothing the page
 * did not already: a record value reaches this markup only as text escaped by
 * `renderToStaticMarkup`, pinned to the text branch by
 * `substituteRecordInContent`, or passed through `sanitizeRichTextHTML` (which
 * strips `<script>`), so the only executable scripts here are the renderer's own
 * inline runtimes. Each of those binds once per element, which is what makes
 * running them again on every open safe. The drawer's `onInjected` step writes a
 * dispatched record into the markup only as input VALUES and as JSON island
 * props — never as markup — so it adds no script either.
 */

import { useEffect, useRef, type RefObject } from 'react'

/** Script types the browser executes; anything else (JSON config) stays data. */
const isExecutableScript = (script: HTMLScriptElement): boolean => {
  const type = script.type.trim().toLowerCase()
  return type === '' || type === 'text/javascript' || type === 'module'
}

/**
 * Marks a script this module has already brought to life, so a host that scans
 * the same subtree more than once (the tabs island, on every tab switch) runs
 * each injected script once — and only a panel injected AGAIN, whose scripts are
 * fresh copies without the mark, runs its scripts again.
 */
const LIVE_SCRIPT_MARK = 'data-injected-live'

/**
 * Replace each executable script with a fresh copy, which the browser runs on
 * insertion. Attributes are copied so a script can still read its own markers.
 * A script already brought to life here is skipped.
 */
export function runInjectedScripts(root: HTMLElement): void {
  Array.from(root.querySelectorAll('script'))
    .filter((script) => isExecutableScript(script) && !script.hasAttribute(LIVE_SCRIPT_MARK))
    .forEach((inert) => {
      const live = document.createElement('script')
      Array.from(inert.attributes).forEach((attr) => live.setAttribute(attr.name, attr.value))
      live.setAttribute(LIVE_SCRIPT_MARK, '')
      // eslint-disable-next-line functional/immutable-data -- a fresh, unattached element; setting its source is how it is built
      live.textContent = inert.textContent
      inert.replaceWith(live)
    })
}

/**
 * Hold back a native submit on injected island forms until their island takes
 * over, which happens in the same pass. A create or automation skeleton cannot
 * submit anyway (its submit is drawn disabled until the island replaces it);
 * this keeps an injected edit skeleton from navigating the document away from
 * the surface it opened in.
 */
function guardIslandForms(root: HTMLElement): void {
  root
    .querySelectorAll<HTMLFormElement>('[data-island] form[data-action-type]')
    .forEach((form) => form.addEventListener('submit', (event) => event.preventDefault()))
}

/**
 * Mount the island markers inside `root` that the page's first-load pass never
 * saw, and return a disposer that unmounts every island then inside `root`.
 *
 * `island-client` is imported dynamically: a static edge from an island to it
 * closes an island-client ↔ registry cycle. The preload runs first so a
 * priority marker (a `crud-form`) commits as the real component rather than
 * behind a Suspense fallback. The mount is skipped when the disposer already
 * ran or `root` left the document while the chunks loaded — a surface closed
 * that fast owes nobody a live form. `mountIslandsWithin` skips a marker that is
 * already mounted, so calling this again over the same root is free.
 *
 * `onMounted` runs after the mount pass (and not at all when it is skipped).
 * The unmount is deferred to the same promise, which also keeps it out of the
 * caller's own React commit: unmounting a root synchronously while React renders
 * another is an error React reports.
 */
export function mountNestedIslands(root: HTMLElement, onMounted?: () => void): () => void {
  const state = { disposed: false }
  const client = import('@/presentation/islands/island-client')
  void client.then(async ({ mountIslandsWithin, preloadIslandsWithin }) => {
    await preloadIslandsWithin(root)
    if (state.disposed || !root.isConnected) return
    mountIslandsWithin(root)
    onMounted?.()
  })
  return () => {
    // eslint-disable-next-line functional/immutable-data -- a one-shot flag the pending mount above reads
    state.disposed = true
    void client.then(({ unmountIslandsWithin }) => unmountIslandsWithin(root))
  }
}

/**
 * Unmount the islands on those of `tracked` that have left the document, and
 * return the island hosts now under `root` — the list to pass back next time.
 *
 * For a host that swaps its own children and keeps the rest: the tabs island,
 * whose inactive panels Base UI removes on a tab switch. `mountNestedIslands`'
 * disposer unmounts everything under the root, so calling it per switch would
 * remount the panel still on screen; this releases ONLY the detached hosts, whose
 * React roots otherwise live on with their listeners. A still-connected host is
 * never touched. Like the disposer, the unmount is deferred to a promise so it
 * never runs inside a React commit.
 */
export function releaseDetachedIslands(
  tracked: readonly HTMLElement[],
  root: HTMLElement
): readonly HTMLElement[] {
  const detached = tracked.filter((host) => !host.isConnected)
  if (detached.length > 0) {
    void import('@/presentation/islands/island-client').then(({ unmountIslandHosts }) =>
      unmountIslandHosts(detached)
    )
  }
  return Array.from(root.querySelectorAll<HTMLElement>('[data-island]'))
}

/**
 * Inject `html` into the returned ref's element, run its scripts and mount its
 * islands; unmount them when the element goes away or the markup changes.
 *
 * `onInjected` runs once the markup and its scripts are in place and BEFORE the
 * islands mount, so it can shape what they mount with — the drawer writes the
 * record a row click dispatched into the form's inputs and its island props
 * there. It is read through a ref, so a new callback identity does not re-key
 * the effect and re-inject everything under it.
 */
export function useLiveInjectedMarkup(
  html: string,
  onInjected?: (root: HTMLElement) => void
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null)
  const onInjectedRef = useRef(onInjected)
  // eslint-disable-next-line functional/immutable-data -- a ref's `.current` is React's own mutable cell, which is what it is for
  onInjectedRef.current = onInjected

  useEffect(() => {
    const root = ref.current
    if (!root) return
    // eslint-disable-next-line functional/immutable-data -- placing the host-rendered markup IS this effect; React must not own these children
    root.innerHTML = html
    runInjectedScripts(root)
    guardIslandForms(root)
    onInjectedRef.current?.(root)
    return mountNestedIslands(root)
  }, [html])

  return ref
}
