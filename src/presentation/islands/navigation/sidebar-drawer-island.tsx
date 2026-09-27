/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import { wireSidebarDrawer } from './sidebar-drawer-controller'

/**
 * The menu button and the modal drawer of a navigation folded below a
 * breakpoint — a `sidebar` declaring `drawer`, and the docs layout's
 * documentation navigation, which folds below `lg` unconditionally.
 *
 * ─── WHY THIS ISLAND RENDERS NOTHING ───────────────────────────────────────
 *
 * The navigation belongs to the server: its entries carry inline icons and may
 * host islands of their own (a fetched group, a live badge, a disclosure).
 * Re-rendering it here would ship the icon set to the browser and tear those
 * islands down, to change where the same nodes are drawn. So the island mounts
 * an empty anchor beside the server-rendered frame and wires plain DOM
 * behaviour onto it; the frame's contents move into the `<dialog>` and back,
 * and every nested island moves with its own root intact.
 */
export default function SidebarDrawerIsland() {
  const anchor = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const root = anchor.current?.closest('[data-sidebar-drawer]')
    if (root === null || root === undefined) return undefined
    return wireSidebarDrawer(root)
  }, [])

  return (
    <span
      ref={anchor}
      hidden
    />
  )
}
