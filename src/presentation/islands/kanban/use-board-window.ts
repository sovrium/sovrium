/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import type { TableRecord } from '../runtime/types'

/** The board's paging, as `dataSource.pagination` declares it. */
export interface BoardPagination {
  readonly pageSize?: number
  readonly style?: 'numbered' | 'loadMore' | 'infinite'
}

/** The cards a board draws, and how it reaches the rest. */
export interface BoardWindow {
  readonly shown: readonly TableRecord[]
  /** Present only on an `infinite` board: the continuation the end of the board drives. */
  readonly continuation?: {
    readonly hasMore: boolean
    readonly loaded: number
    readonly total: number
    readonly onLoadMore: () => void
  }
}

/**
 * The cards an `infinite` board draws: its first `pageSize` cards in the
 * board's order, one page more each time the end of the board scrolls into view
 * (or its Load more control is pressed). One continuation for the whole board,
 * each card placed in its own column by its value. Every other board draws all
 * its cards, as it always has.
 */
export function useBoardWindow(
  records: readonly TableRecord[],
  pagination: BoardPagination | undefined
): BoardWindow {
  const [pages, setPages] = useState(1)
  const pageSize = pagination?.pageSize
  if (pagination?.style !== 'infinite' || pageSize === undefined) return { shown: records }
  const shown = records.slice(0, pages * pageSize)
  return {
    shown,
    continuation: {
      hasMore: shown.length < records.length,
      loaded: shown.length,
      total: records.length,
      onLoadMore: () => setPages((count) => count + 1),
    },
  }
}
