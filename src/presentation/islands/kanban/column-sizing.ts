/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { KanbanGroupBy } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { CSSProperties } from 'react'

/** The width placement of one column well: its classes and, for a named width, its style. */
export interface KanbanColumnPlacement {
  readonly className: string
  readonly style: CSSProperties | undefined
}

/**
 * Below `md` every column keeps the readable 18rem and the board scrolls
 * sideways, whatever the author declared: a phone cannot fit two columns.
 */
const FIXED = 'w-72 shrink-0'

/** `columnSizing: fill` — the columns share the board's width from md up. */
const FILL = 'md:w-auto md:min-w-0 md:flex-1'

/**
 * A width named in `columnWidths`, from md up. The length travels as a custom
 * property so ONE static class (harvested by the build-time candidate scan)
 * serves every value an author can write.
 */
const NAMED = 'md:w-[var(--kanban-column-width)] md:flex-none'

/**
 * Where one column of a single-axis board sits, from `kanbanGroupBy.columnSizing`
 * and `kanbanGroupBy.columnWidths`.
 *
 * @param groupBy - The board's `kanbanGroupBy`, if any.
 * @param value - The column value, as the grouping field spells it.
 */
export const kanbanColumnPlacement = (
  groupBy: KanbanGroupBy | undefined,
  value: string
): KanbanColumnPlacement => {
  const width = groupBy?.columnWidths?.[value]
  if (width !== undefined) {
    return {
      className: `${FIXED} ${NAMED}`,
      style: { ['--kanban-column-width' as string]: width } as CSSProperties,
    }
  }
  return {
    className: groupBy?.columnSizing === 'fill' ? `${FIXED} ${FILL}` : FIXED,
    style: undefined,
  }
}
