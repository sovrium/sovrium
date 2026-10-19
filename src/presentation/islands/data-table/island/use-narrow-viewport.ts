/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import type { DataTableColumnDef } from './table-features'

/**
 * Whether the viewport matches a `max-width` media query, followed live. `false`
 * until the first effect, so the server markup and the first client render agree.
 */
export function useViewportBelow(query: string): boolean {
  const [below, setBelow] = useState(false)
  useEffect(() => {
    const list = window.matchMedia(query)
    const sync = (): void => setBelow(list.matches)
    sync()
    list.addEventListener('change', sync)
    return () => list.removeEventListener('change', sync)
  }, [query])
  return below
}

/**
 * A grid wider than its container scrolls sideways, and a row read without its
 * first column is a row of values with no name. So the first field column is
 * pinned — at every width, since a wide grid overflows a wide screen too —
 * unless the author pinned columns of their own, whose choice stands. A pin is
 * inert while the grid fits: a sticky cell only moves once there is something
 * to scroll, and its surface is worn only while scrolled.
 */
function pinFirstColumn(columns: readonly DataTableColumnDef[]): readonly DataTableColumnDef[] {
  if (columns.some((column) => column.meta?.frozen === true)) return columns
  const first = columns.findIndex((column) => column.meta?.field !== undefined)
  if (first === -1) return columns
  return columns.map((column, index) =>
    index === first ? { ...column, meta: { ...column.meta, frozen: true } } : column
  )
}

/** The columns, with the first field column pinned. */
export function usePinnedFirstColumn(
  columns: readonly DataTableColumnDef[]
): readonly DataTableColumnDef[] {
  return pinFirstColumn(columns)
}
