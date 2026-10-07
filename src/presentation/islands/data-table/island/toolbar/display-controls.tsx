/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableToolbarButtonClasses } from '@/presentation/design/table-default-classes'
import { useGridString } from '../grid-strings'
import { ExportControl, ExportSelectedButton } from './export-controls'
import type { DataTableInstance } from '../table-features'
import type { ActiveFilter } from '../use-ui-state'

/**
 * The controls that change how the rows already fetched are PRESENTED or taken
 * away: export and refresh.
 */
export interface DisplayControlsProps {
  readonly table: DataTableInstance
  readonly tableName: string
  /** Multi-row selection is on, so a selection-scoped export is meaningful. */
  readonly canExportSelection: boolean
  readonly selectedCount: number
  readonly exportEnabled: boolean
  /**
   * The system READ endpoint, present for every `dataSource.system` binding.
   * Both export controls read it, and each asks it a different question:
   * {@link ExportControl} navigates to its `?format=csv` (and only on a
   * read-only source), while {@link ExportSelectedButton} takes its presence as
   * proof there is no DB table to route a selection through.
   */
  readonly systemExportEndpoint?: string
  readonly readOnly: boolean
  readonly activeFilter: ActiveFilter | undefined
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
  readonly refreshEnabled: boolean
  readonly onRefresh: () => void
}

export function DisplayControls(props: DisplayControlsProps) {
  const refreshLabel = useGridString('datatable.refresh', 'Refresh')
  return (
    <>
      {props.canExportSelection && (
        <ExportSelectedButton
          table={props.table}
          tableName={props.tableName}
          selectedCount={props.selectedCount}
          systemExportEndpoint={props.systemExportEndpoint}
        />
      )}
      {props.exportEnabled && (
        <ExportControl
          systemExportEndpoint={props.systemExportEndpoint}
          readOnly={props.readOnly}
          tableName={props.tableName}
          table={props.table}
          activeFilter={props.activeFilter}
          exportMenuOpen={props.exportMenuOpen}
          onToggleExportMenu={props.onToggleExportMenu}
          onCloseExportMenu={props.onCloseExportMenu}
        />
      )}
      {props.refreshEnabled && (
        <button
          type="button"
          className={computeTableToolbarButtonClasses()}
          aria-label={refreshLabel}
          onClick={props.onRefresh}
        >
          {refreshLabel}
        </button>
      )}
    </>
  )
}
