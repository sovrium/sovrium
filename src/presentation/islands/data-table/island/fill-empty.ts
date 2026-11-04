/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTableLayout } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/** What decides whether a grid holds no row at all: its rows, its read, its narrowing. */
export interface HoldsNoRowInput {
  readonly rowCount: number
  readonly isLoading: boolean
  readonly narrowed?: boolean
  readonly globalFilter?: string
}

/**
 * Whether the grid holds no row at all — answered, and not narrowed by a search
 * or a control on the page. A narrowed grid holding nothing is a no-match, which
 * keeps its frame so the reader sees where the rows will come back.
 */
export const holdsNoRow = (input: HoldsNoRowInput): boolean =>
  input.rowCount === 0 &&
  !input.isLoading &&
  input.narrowed !== true &&
  (input.globalFilter ?? '').trim() === ''

/**
 * Whether a `layout: fill` grid draws compactly: holding no row at all, it takes
 * its natural height instead of stretching an empty frame down its column, and
 * draws no bottom bar, there being nothing to page through. The view marks itself
 * with `data-fill-empty` so the server-drawn frame around it stops growing too.
 */
export const drawsCompactFill = (
  layout: DataTableLayout | undefined,
  input: HoldsNoRowInput
): boolean => layout === 'fill' && holdsNoRow(input)
