/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react'
import type { DataTableColumnDef } from './table-features'

/** Below 1280px a grid's columns no longer fit beside a sidebar: it scrolls sideways. */
const NARROW_QUERY = '(max-width: 1279.98px)'

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
 * On a narrow screen the grid scrolls sideways, and a row read without its first
 * column is a row of values with no name. So the first field column is pinned
 * there — unless the author pinned columns of their own, whose choice stands.
 */
function pinFirstColumnWhenNarrow(
  columns: readonly DataTableColumnDef[],
  narrow: boolean
): readonly DataTableColumnDef[] {
  if (!narrow || columns.some((column) => column.meta?.frozen === true)) return columns
  const first = columns.findIndex((column) => column.meta?.field !== undefined)
  if (first === -1) return columns
  return columns.map((column, index) =>
    index === first ? { ...column, meta: { ...column.meta, frozen: true } } : column
  )
}

/** The columns, with the first one pinned while the viewport is narrow. */
export function usePinnedOnNarrow(
  columns: readonly DataTableColumnDef[]
): readonly DataTableColumnDef[] {
  return pinFirstColumnWhenNarrow(columns, useViewportBelow(NARROW_QUERY))
}
