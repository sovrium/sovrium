/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableToolbarButtonClasses } from '@/presentation/design/table-default-classes'
import { DensityMenu } from '../density-menu'
import { SettingsDialog } from '../settings-dialog'
import { ColumnsMenu } from '../toolbar-menus'
import { ExportControl, ExportSelectedButton } from './export-controls'
import type { RowDensity } from '../../../hooks/use-table-preferences'
import type { DataTableInstance } from '../table-features'
import type { ActiveFilter } from '../use-ui-state'

/**
 * The controls that change how the rows already fetched are PRESENTED or taken
 * away: column visibility, export, refresh, density, and preference reset.
 */
export interface DisplayControlsProps {
  readonly table: DataTableInstance
  readonly tableName: string
  readonly columnToggleEnabled: boolean
  readonly columnsMenuOpen: boolean
  readonly onToggleColumnsMenu: () => void
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
  readonly densityEnabled: boolean
  readonly currentDensity: RowDensity
  readonly onSelectDensity: (density: RowDensity) => void
  /**
   * Reset every personal preference for this table (column widths, density,
   * column order, default view). When undefined the Settings button is hidden.
   *
   * The dialog rides the density flag because that flag is what declares this
   * grid HAS preferences to remember. Rendering it unconditionally put a
   * "Reset to defaults" in front of every grid, including the ones with
   * nothing to reset.
   */
  readonly onResetPreferences?: () => void
}

export function DisplayControls(props: DisplayControlsProps) {
  return (
    <>
      {props.columnToggleEnabled && (
        <div className="relative">
          <button
            type="button"
            className={computeTableToolbarButtonClasses({ active: props.columnsMenuOpen })}
            aria-label="Columns"
            onClick={props.onToggleColumnsMenu}
          >
            Columns
          </button>
          {props.columnsMenuOpen && <ColumnsMenu table={props.table} />}
        </div>
      )}
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
          aria-label="Refresh"
          onClick={props.onRefresh}
        >
          Refresh
        </button>
      )}
      {props.densityEnabled && (
        <DensityMenu
          current={props.currentDensity}
          onSelect={props.onSelectDensity}
        />
      )}
      {props.densityEnabled && props.onResetPreferences && (
        <SettingsDialog onReset={props.onResetPreferences} />
      )}
    </>
  )
}
