/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

/** Held in an object so `useState` stores the component instead of calling it as an updater. */
interface Loaded<P> {
  readonly Component: (props: P) => ReactElement
}

/**
 * Resolve a code-split component in an effect, and render nothing that uses it
 * until it has arrived.
 *
 * This is deliberately NOT `React.lazy`, and the reason is Tiptap. `lazy()`
 * means Suspense; React renders a suspending child into a hidden subtree and
 * DISCONNECTS its effects for the duration of the download. Tiptap's cleanup
 * then calls `scheduleDestroy()`, which tears the editor down on a 1 ms
 * `setTimeout` unless the component has re-mounted by the time it fires (see
 * `EditorInstanceManager` in `@tiptap/react`). No network fetch is that fast,
 * so the editor dies mid-download and is never rebuilt: every effect that
 * touches it throws during commit, where no boundary catches it, and the whole
 * island root unmounts to a blank page. A `<Suspense>` boundary placed closer
 * to the editor fails identically — the hide/reconnect cycle is what does the
 * damage, not the distance to the boundary.
 *
 * Resolving the module first gives the editor exactly one clean mount, which is
 * the lifecycle Tiptap supports.
 *
 * CodeMirror was checked and does not share the hazard: `@uiw/react-codemirror`
 * destroys its view in a plain unmount cleanup with no timer, and its create
 * effect is guarded by `if (!view)`, so a disconnect/reconnect simply rebuilds
 * the view. It uses this hook for consistency, not out of necessity — one shape
 * for every deferred editor is worth more than saving it twenty lines.
 *
 * A failed fetch leaves the caller's placeholder in place rather than throwing.
 * The surface stays inert and escapable, where an unhandled rejection here
 * would unmount the island and take the rest of the page with it.
 *
 * @param load Must be a stable module-level reference. An arrow function
 *   written inline at the call site is a new value on every render and would
 *   re-run the effect (and re-import) each time.
 */
export function useDeferredComponent<P>(
  load: () => Promise<(props: P) => ReactElement>
): ((props: P) => ReactElement) | undefined {
  const [loaded, setLoaded] = useState<Loaded<P> | undefined>(undefined)

  useEffect(() => {
    // eslint-disable-next-line functional/no-let -- cancellation flag for an async load that can outlive the mount
    let live = true
    void load().then(
      (Component) => {
        if (live) setLoaded({ Component })
      },
      () => {
        // Swallowed on purpose — see the docstring.
      }
    )
    return () => {
      live = false
    }
  }, [load])

  return loaded?.Component
}
