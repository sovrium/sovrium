/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useId, useMemo } from 'react'

/** The grid's `caption`, and the id the bottom bar draws it under. */
export interface GridCaption {
  readonly id: string
  readonly text: string
}

/**
 * The author's note on what the grid lists, shadcn's `TableCaption` for a grid
 * bound to data. Two places read it and they share no parent below the island
 * root: the bottom bar draws it after the range or the count, and the `<table>`
 * names that drawn line as its accessible description (`aria-describedby`).
 * Absent on a grid that declares no caption, which then draws exactly what it
 * drew before the key was read.
 *
 * Local to this island for the reason `grid-strings.ts` gives.
 */
export const GridCaptionContext = createContext<GridCaption | undefined>(undefined)

/** The provider value for one grid: `undefined` when it declares no caption, or an empty one. */
export function useGridCaption(text: string | undefined): GridCaption | undefined {
  const id = useId()
  return useMemo(
    () => (text === undefined || text.trim() === '' ? undefined : { id, text }),
    [id, text]
  )
}
