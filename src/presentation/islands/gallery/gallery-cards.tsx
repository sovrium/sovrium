/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Suspense, lazy, type ReactElement, type ReactNode } from 'react'
import { GalleryViewerRowsContext, type GalleryViewerRows } from './gallery-classes-context'
import { GalleryGrid } from './gallery-grid'
import type { RecordGroupBy } from '../parts/grouped-records'
import type { TableRecord } from '../runtime/types'

/** A grouped view's headers, fetched only by a gallery bound to one. */
const GroupedRecords = lazy(() => import('../parts/grouped-records'))

/** The cards of a grid, under the bound view's groups when it has any. */
export function GalleryCards(
  props: Omit<Parameters<typeof GalleryGrid>[0], 'records'> & {
    readonly records: readonly TableRecord[]
    readonly groupBy: RecordGroupBy | undefined
    /** The gallery's words in the page language — the empty group's heading among them. */
    readonly uiStrings: Readonly<Record<string, string>> | undefined
  }
): ReactElement {
  const { groupBy, uiStrings, ...grid } = props
  if (groupBy === undefined) return <GalleryGrid {...grid} />
  return (
    <Suspense fallback={null}>
      <GroupedRecords
        records={grid.records}
        groupBy={groupBy}
        emptyLabel={uiStrings?.['gallery.noGroupValue'] ?? 'No value'}
        renderRecords={(records, value) => (
          <div data-group={value}>
            <GalleryGrid
              {...grid}
              records={records}
            />
          </div>
        )}
      />
    </Suspense>
  )
}

/** Hands the cards the reader's rows, when the gallery joins them. */
export const ViewerRowsScope = ({
  control,
  children,
}: {
  readonly control: GalleryViewerRows | undefined
  readonly children: ReactNode
}) =>
  control === undefined ? (
    children
  ) : (
    <GalleryViewerRowsContext.Provider value={control}>
      {children}
    </GalleryViewerRowsContext.Provider>
  )
