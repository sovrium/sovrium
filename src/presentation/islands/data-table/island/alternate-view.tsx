/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Suspense } from 'react'
import { CalendarIslandLazy, GalleryIslandLazy, KanbanIslandLazy } from '../../view-type-islands'
import type { ActiveViewType } from './use-ui-state'
import type { TableRecord } from '../../runtime/types'
import type { DataTableKanbanGroupBy } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

export interface AlternateViewProps {
  /** Which non-grid view the switcher selected. Never `'grid'` — see the guard. */
  readonly activeView: Exclude<ActiveViewType, 'grid'>
  /**
   * The rows the GRID is currently showing, post-filter and post-search.
   *
   * Handing the view island the grid's own rows (rather than letting it
   * re-query) is what makes a runtime search survive a switch: a board that
   * re-fetched would quietly show the whole table again while still satisfying
   * any "the board is visible" assertion.
   */
  readonly records: readonly TableRecord[]
  readonly kanbanGroupBy?: DataTableKanbanGroupBy
  readonly dateField?: string
  /** Shown when a board cannot be built from the rows it was given. */
  readonly emptyMessage: string
}

/** Placeholder held while the selected view type's chunk is in flight. */
function ViewLoading(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading view"
      className="p-4"
    >
      <div className="bg-background-subtle h-24 animate-pulse rounded" />
    </div>
  )
}

/**
 * Board branch. No view island names itself: on a page the SSR island host
 * carries the `data-component` marker, and the mounted component deliberately
 * does not duplicate it. Embedded here there is no such host, so every view
 * supplies the naming wrapper itself — the board below, the calendar and the
 * gallery in {@link AlternateView}, each with the view or layout it opens on,
 * as the island host would carry it.
 */
function KanbanView({
  records,
  kanbanGroupBy,
  emptyMessage,
}: {
  readonly records: readonly TableRecord[]
  readonly kanbanGroupBy: DataTableKanbanGroupBy | undefined
  readonly emptyMessage: string
}): ReactElement {
  const groupField = kanbanGroupBy?.field
  // Presence of `kanbanGroupBy` is guaranteed by validation; that a SYSTEM
  // endpoint's rows actually carry the named key is not — the endpoint's row
  // shape is declared nowhere. That residue lands here as an explained empty
  // state instead of a blank board.
  const groupable = groupField !== undefined && records.some((r) => r[groupField] !== undefined)
  return (
    <div data-component="kanban">
      {groupable ? (
        <KanbanIslandLazy
          records={records}
          kanbanGroupBy={kanbanGroupBy}
        />
      ) : (
        <p
          role="status"
          className="text-foreground-muted text-md p-4"
        >
          {emptyMessage}
        </p>
      )}
    </div>
  )
}

/**
 * Render the non-grid view the switcher selected, over the grid's own rows.
 *
 * All three islands arrive through `view-type-islands.ts`'s `React.lazy`
 * bindings, so selecting a view is what downloads it — the universal island
 * payload never carries FullCalendar, @dnd-kit or the gallery grid. The local
 * `Suspense` keeps that download from bubbling to the island-client boundary,
 * which would flash the whole data-table (toolbar included) back to its SSR
 * skeleton on every switch.
 */
export function AlternateView({
  activeView,
  records,
  kanbanGroupBy,
  dateField,
  emptyMessage,
}: AlternateViewProps): ReactElement {
  return (
    <Suspense fallback={<ViewLoading />}>
      {activeView === 'kanban' && (
        <KanbanView
          records={records}
          kanbanGroupBy={kanbanGroupBy}
          emptyMessage={emptyMessage}
        />
      )}
      {activeView === 'calendar' && (
        <div
          data-component="calendar"
          data-view="month"
        >
          <CalendarIslandLazy
            records={records}
            dateField={dateField}
          />
        </div>
      )}
      {activeView === 'gallery' && (
        <div
          data-component="gallery"
          data-layout="grid"
          data-gallery-layout="grid"
        >
          <GalleryIslandLazy
            records={records}
            emptyMessage={emptyMessage}
          />
        </div>
      )}
    </Suspense>
  )
}
