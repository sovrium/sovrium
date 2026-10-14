/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Menu } from '@base-ui/react/menu'
import {
  computeMenuItemClasses,
  computeMenuPopupClasses,
} from '../../overlays/menu-default-classes'
import { buildCsvExportHref, buildJsonExportHref } from './export-helpers'
import type { DataTableInstance } from './table-features'
import type { ActiveFilter } from './use-ui-state'

/**
 * The export menu's popup: shadcn's `DropdownMenuContent`, aligned to the end
 * of its trigger, one link item per format. Each item is a download link, so
 * the browser saves the file the server answers with.
 */
export function ExportMenu({
  tableName,
  table,
  activeFilter,
}: {
  readonly tableName: string
  readonly table: DataTableInstance
  readonly activeFilter: ActiveFilter | undefined
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        side="bottom"
        align="end"
        sideOffset={4}
        className="isolate z-50 outline-none"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={computeMenuPopupClasses()}
        >
          <Menu.LinkItem
            data-slot="dropdown-menu-item"
            href={buildCsvExportHref(tableName, table, activeFilter)}
            download
            closeOnClick
            className={computeMenuItemClasses()}
          >
            Export as CSV
          </Menu.LinkItem>
          <Menu.LinkItem
            data-slot="dropdown-menu-item"
            href={buildJsonExportHref(tableName, activeFilter)}
            download
            closeOnClick
            className={computeMenuItemClasses()}
          >
            Export as JSON
          </Menu.LinkItem>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
