/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef } from 'react'
import { RUNTIME_READY_MARKS } from '@/presentation/design/runtime-ready-marks'
import {
  mountNestedIslands,
  releaseDetachedIslands,
  runInjectedScripts,
} from '../overlays/live-injected-markup'

/**
 * Panels the server rendered as markup: reading them off the host, and
 * mounting the islands nested inside the panel that is showing.
 */

/**
 * The markup of each panel the SERVER rendered into this host, keyed by panel id.
 *
 * Parsed from the captured subtree rather than read live: by the time any island
 * code runs, `createRoot` has already discarded those nodes. Their scripts run
 * again once the panel is injected (`useNestedIslandMount`). Assigning to a
 * detached element's `innerHTML` never executes a `<script>` in it, and nothing
 * here adopts a parsed node into the live tree — the strings go back through the
 * same `dangerouslySetInnerHTML` path the props always took.
 *
 * SECURITY (standing rule S2): these bytes are this page's own server render,
 * produced moments ago for this request — the same markup the document was built
 * from, taking a shorter route back into it. Record values inside were escaped
 * by the server exactly as on first load, so no second sanitiser is introduced.
 */
export function parseSsrPanels(ssrHtml: string | undefined): Readonly<Record<string, string>> {
  if (ssrHtml === undefined || typeof document === 'undefined') return {}
  const holder = document.createElement('div')
  holder.innerHTML = ssrHtml
  // The capture was taken after the page's inline scripts ran, so a control
  // they wired carries the mark its runtime left on the node it bound — a node
  // `createRoot` has since discarded. Cleared, so each runtime binds the copy.
  RUNTIME_READY_MARKS.forEach((mark) =>
    holder.querySelectorAll(`[${mark}]`).forEach((node) => node.removeAttribute(mark))
  )
  return Object.fromEntries(
    Array.from(holder.querySelectorAll<HTMLElement>('[data-tab-panel-id]')).map((panel) => [
      panel.dataset.tabPanelId ?? '',
      panel.innerHTML,
    ])
  )
}

/**
 * Re-scan this tabs subtree for nested `data-island` markers so they hydrate.
 * The panels are injected via `dangerouslySetInnerHTML` (see below), so their
 * nested markers (a split-pane editor, a record grid, a metrics panel) are NOT
 * present in the first-load `mountIslandsWithin()` pass — and Base UI only keeps
 * the ACTIVE panel mounted, so a marker in an initially-inactive panel
 * (Analytique / Données) appears only when that tab is first selected.
 * `mountIslandsWithin` is idempotent (skips `data-island-mounted` markers), so
 * this is safe to run on every tab change as well as on mount. Dynamically
 * imported to keep the static import graph free of an island-client ↔ registry
 * cycle.
 *
 * The preload runs first for the same reason it does on first load: a panel can
 * contain a priority island (a split-pane, a crud-form), and resolving it before
 * the mount pass is what lets `flushSync` commit the real component rather than
 * leaving the panel's SSR skeleton owning events behind a Suspense boundary.
 * Both steps, and the unmount when the tab set goes away, are the shared
 * `mountNestedIslands`.
 *
 * The same pass brings the panels' scripts to life (`runInjectedScripts`):
 * markup placed through `dangerouslySetInnerHTML` never runs its `<script>`s, and
 * an embedded `formRef` form ships its client runtime — validation, background
 * submit, the audio recorder — as exactly such a script. It runs once per
 * injected copy of a panel, and the runtime binds once per form node.
 *
 * Only the LATEST scan's disposer is kept, and it runs only when the tab set
 * itself unmounts. Every disposer unmounts the same thing — every island under
 * the root — so disposing on each re-scan would tear down, and remount, the
 * panel still on screen: a flash, and whatever was typed into its form gone.
 * What a tab switch DOES release, after each mount pass, is the islands of the
 * panel Base UI just removed (`releaseDetachedIslands`): their hosts are off the
 * document, so no scan of the root can reach them, and their React roots would
 * otherwise live on with their listeners.
 */
export function useNestedIslandMount(rootRef: React.RefObject<HTMLDivElement | null>): () => void {
  const disposeRef = useRef<(() => void) | undefined>(undefined)
  const hostsRef = useRef<readonly HTMLElement[]>([])
  const scan = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    disposeRef.current = mountNestedIslands(root, () => {
      runInjectedScripts(root)
      hostsRef.current = releaseDetachedIslands(hostsRef.current, root)
    })
  }, [rootRef])
  useEffect(() => {
    scan()
    return () => disposeRef.current?.()
  }, [scan])
  return scan
}
