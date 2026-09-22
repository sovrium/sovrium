/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableFillShellClasses } from '@/presentation/design/table-default-classes'
import { ArmedConfirmProvider } from '../../armed-confirm-provider'
import { DataTableToolbarBar } from '../toolbar/toolbar-bar'
import { useViewProps } from '../use-view-props'
import { StatusBanners } from './status-banners'
import { TableSurface } from './table-surface'
import { GridImportDialog, ViewDialogs } from './view-dialogs'
import type { DataTableViewProps } from '../view-props'

/**
 * The JSX presenter for the data-table island.
 *
 * Pure rendering: `useViewProps` turns the island's flat prop surface into one
 * bag per region, and this shell does nothing but place the regions and own
 * the container element.
 *
 * It does own ONE piece of state, and it owns it because of where it sits
 * rather than because it is a presenter: which destructive question the
 * operator currently has open. The action cells that draw that question are
 * rebuilt from scratch every time the grid re-reads itself, and this shell is
 * the nearest thing above them that merely re-renders — see
 * `armed-confirm.tsx`.
 */
export function DataTableView(props: DataTableViewProps) {
  const regions = useViewProps(props)

  return (
    <ArmedConfirmProvider>
      <div
        ref={props.containerRef}
        // Chrome-less: the surface tokens (`bg-background-raised`, `border-border`,
        // rounding, border) live on the `[data-component="data-table"]` island
        // host (see island-data-components.tsx), which this view is rendered
        // INTO via `createRoot`. Repeating the chrome here would double the
        // border. The host owns the visible surface; this view owns layout only.
        //
        // Under `layout: fill` this view is the second link in the chain running
        // from the bounded ancestor down to the rows. The host grew into the
        // height its parent left it; this element has to pass that height on
        // rather than fall back to its content's. It is also the one link in that
        // chain hydration OWNS, so a frame dressed server-side comes undone here
        // if this element keeps its natural height.
        //
        // It carries the floor as well as the height, and from the CURRENT row
        // height rather than the authored one: this element re-renders when the
        // density control moves, so the frame's minimum tracks the rhythm the
        // rows are actually being drawn at.
        className={`w-full overflow-hidden${
          props.layout === 'fill'
            ? ` ${computeTableFillShellClasses({ rowHeight: props.currentRowHeight })}`
            : ''
        }`}
        // Realtime transport connectivity: exposes the
        // logical connection state (connected/reconnecting/disconnected) so a
        // page section can render a connection indicator. Absent when the data
        // source is not in `realtime` refresh mode.
        data-connection-status={props.connectionStatus}
      >
        <StatusBanners {...regions.banners} />
        <DataTableToolbarBar {...regions.toolbar} />
        <ViewDialogs {...regions.dialogs} />
        <TableSurface {...regions.surface} />
        <GridImportDialog {...regions.dialogs} />
      </div>
    </ArmedConfirmProvider>
  )
}
