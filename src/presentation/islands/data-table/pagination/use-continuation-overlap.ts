/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useMemo } from 'react'
import type { SystemCursorPages } from '../../hooks/use-system-cursor-pages'
import type { TableRecord } from '../../runtime/types'

interface FeedPage {
  readonly records?: readonly TableRecord[]
  readonly nextCursor?: string
  readonly total?: number
}

const idOf = (record: TableRecord): string | undefined =>
  record['id'] === undefined || record['id'] === null ? undefined : String(record['id'])

/**
 * A load-more or infinite grid's next page, with the rows it already holds left
 * out.
 *
 * The continuation is an offset. When a record is added before the rows already
 * loaded, every later row moves down by one, and the page asked for at the old
 * offset opens on rows the grid holds: kept, they would repeat. So the repeated
 * rows are dropped from the page drawn, and the page is asked for again that
 * many rows further on, which carries on from the last row loaded. The added
 * record is not slipped into the window the reader has scrolled past; the total
 * the grid announces counts it.
 */
export function useContinuationOverlap(
  pages: SystemCursorPages,
  page: FeedPage | undefined,
  isStale: boolean,
  enabled: boolean
): FeedPage | undefined {
  const held = useMemo(
    () => new Set(pages.carried.map(idOf).filter((id) => id !== undefined)),
    [pages.carried]
  )
  const repeated = useMemo(
    () =>
      enabled && held.size > 0
        ? (page?.records ?? []).filter((record) => {
            const id = idOf(record)
            return id !== undefined && held.has(id)
          }).length
        : 0,
    [enabled, held, page]
  )
  const { shift } = pages
  useEffect(() => {
    if (repeated > 0 && !isStale) shift(repeated)
  }, [repeated, isStale, shift])
  return useMemo(() => {
    if (repeated === 0 || page?.records === undefined) return page
    return {
      ...page,
      records: page.records.filter((record) => {
        const id = idOf(record)
        return id === undefined || !held.has(id)
      }),
    }
  }, [page, repeated, held])
}
