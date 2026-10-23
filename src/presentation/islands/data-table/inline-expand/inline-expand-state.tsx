/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { InlineExpandContext, type InlineExpandConfig } from './inline-expand-context'

/**
 * Which rows are open, by record id, for the grid's life. Kept by id rather
 * than by position, so a re-read that redraws the rows — a poll, a realtime
 * update — leaves open what was open, now with the fresh values; a row that
 * left the page is simply not drawn.
 */
export function InlineExpandProvider({
  config,
  table,
  children,
}: {
  readonly config: InlineExpandConfig | undefined
  readonly table: string | undefined
  readonly children: ReactNode
}): ReactNode {
  const [open, setOpen] = useState<readonly string[]>([])
  const single = config?.single !== false
  const toggle = useCallback(
    (rowId: string) =>
      setOpen((current) => {
        if (current.includes(rowId)) return current.filter((id) => id !== rowId)
        return single ? [rowId] : [...current, rowId]
      }),
    [single]
  )
  const value = useMemo(
    () =>
      config === undefined
        ? undefined
        : { config, table, isExpanded: (rowId: string) => open.includes(rowId), toggle },
    [config, table, open, toggle]
  )
  return <InlineExpandContext.Provider value={value}>{children}</InlineExpandContext.Provider>
}
