/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableMenuClasses,
  computeTableMenuItemClasses,
} from '@/presentation/design/table-default-classes'
import { buildCsvExportHref, buildJsonExportHref } from './export-helpers'
import type { DataTableInstance } from './table-features'
import type { ActiveFilter } from './use-ui-state'

// ---------------------------------------------------------------------------
// ExportMenu (CSV/JSON dropdown)
// ---------------------------------------------------------------------------

export function ExportMenu({
  tableName,
  table,
  activeFilter,
  onClose,
}: {
  readonly tableName: string
  readonly table: DataTableInstance
  readonly activeFilter: ActiveFilter | undefined
  readonly onClose: () => void
}) {
  return (
    <div
      role="menu"
      className={`${computeTableMenuClasses()} absolute top-full right-0 mt-1`}
    >
      <a
        href={buildCsvExportHref(tableName, table, activeFilter)}
        download
        role="menuitem"
        className={computeTableMenuItemClasses()}
        onClick={onClose}
      >
        Export as CSV
      </a>
      <a
        href={buildJsonExportHref(tableName, activeFilter)}
        download
        role="menuitem"
        className={computeTableMenuItemClasses()}
        onClick={onClose}
      >
        Export as JSON
      </a>
    </div>
  )
}
