/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react'
import { SaveStatusIndicator } from '../save-status-indicator'
import { DensityMenu } from './density-menu'
import { getNonSelectColumnCount, getVisibleColumnIds, type ActiveFilter } from './export-helpers'
import { GroupMenu } from './group-menu'
import { SettingsDialog } from './settings-dialog'
import { ColumnsMenu, ExportMenu } from './toolbar-menus'
import { DROPDOWN_TRIGGER_CLASS } from './use-dropdown-state'
import { ViewSwitcher } from './view-switcher'
import { ViewsMenu, type ViewsMenuEntry } from './views-menu'
import type { ActiveViewType } from './use-ui-state'
import type { SaveStatus } from '../../hooks/use-inline-editing'
import type { RowDensity } from '../../hooks/use-table-preferences'
import type { TableRecord } from '../../shared/types'
import type {
  ComponentSearch,
  DataTableSelection,
  DataTableToolbar,
  DataTableViewLabels,
  DataTableViewType,
} from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { useReactTable } from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// SearchToolbar
// ---------------------------------------------------------------------------

interface SearchToolbarProps {
  readonly search: ComponentSearch
  readonly value: string
  readonly onChange: (value: string) => void
  /**
   * Report that a typed term has NOT yet reached the grid — the debounce window
   * between the keystroke and the re-read.
   *
   * The grid needs this because during that window everything on screen answers
   * the PREVIOUS question. An action taken then acts on a view that is about to
   * be replaced: a "load more" issued mid-window continues the UNFILTERED feed,
   * appends a page of it, and has the whole accumulation discarded a fraction of
   * a second later when the term lands — so the request is not merely wasted,
   * it briefly shows the operator rows their own search excludes.
   */
  readonly onPendingChange?: (pending: boolean) => void
}

export function SearchToolbar({ search, value, onChange, onPendingChange }: SearchToolbarProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceMs = search.debounceMs ?? 300

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue)
      onPendingChange?.(false)
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange, onPendingChange])

  useEffect(() => setLocalValue(value), [value])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value)
      // Reported from the keystroke handler rather than an effect: the window
      // opens the instant the character is typed, and an effect would leave one
      // commit in which the grid still believed itself current.
      onPendingChange?.(e.target.value !== value)
    },
    [onPendingChange, value]
  )

  return (
    <input
      type="search"
      placeholder={search.placeholder ?? 'Search...'}
      value={localValue}
      onChange={onInputChange}
      className="border-border focus:border-primary focus:ring-focus-ring w-full max-w-sm rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
      aria-label={search.placeholder ?? 'Search'}
    />
  )
}

// ---------------------------------------------------------------------------
// ExportControl
// ---------------------------------------------------------------------------

interface ExportControlProps {
  /**
   * System read-endpoint. When present on a read-only source, the control is an
   * "Export" button navigating to `{endpoint}?format=csv`.
   */
  readonly systemExportEndpoint?: string
  readonly readOnly: boolean
  readonly tableName: string
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly activeFilter: ActiveFilter | undefined
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
}

/**
 * The toolbar export affordance, rendered only where `toolbar.export` declares
 * it (the caller owns that gate).
 *
 * A read-only system source navigates the browser to the system endpoint's
 * `?format=csv` — the server's `Content-Disposition` drives the download. Every
 * other case keeps the DB-table records-export dropdown targeting
 * `/api/tables/:t/export`.
 *
 * The gate is what keeps those two apart. This control used to render on every
 * grid, and a system source that had NOT declared `export` fell through to the
 * DB-table branch with an empty table name — an "Export" menu pointing at
 * `/api/tables//export`, which 404s with an HTML error page. There is no
 * URL-building bug to fix underneath: not offering the control is the fix.
 */
function ExportControl({
  systemExportEndpoint,
  readOnly,
  tableName,
  table,
  activeFilter,
  exportMenuOpen,
  onToggleExportMenu,
  onCloseExportMenu,
}: ExportControlProps) {
  const onSystemExportClick = useCallback(() => {
    if (!systemExportEndpoint) return
    const separator = systemExportEndpoint.includes('?') ? '&' : '?'
    /* eslint-disable-next-line functional/immutable-data -- imperative navigation
       is required to fire the browser-native CSV download from a button click
       against the system read endpoint's export route */
    window.location.href = `${systemExportEndpoint}${separator}format=csv`
  }, [systemExportEndpoint])

  if (readOnly && systemExportEndpoint) {
    return (
      <button
        type="button"
        className={DROPDOWN_TRIGGER_CLASS}
        aria-label="Export"
        onClick={onSystemExportClick}
      >
        Export
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={DROPDOWN_TRIGGER_CLASS}
        aria-label="Export"
        aria-haspopup="true"
        aria-expanded={exportMenuOpen}
        onClick={onToggleExportMenu}
      >
        Export
      </button>
      {exportMenuOpen && (
        <ExportMenu
          tableName={tableName}
          table={table}
          activeFilter={activeFilter}
          onClose={onCloseExportMenu}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DataTableToolbarBar
// ---------------------------------------------------------------------------

interface DataTableToolbarBarProps {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly tableName: string
  readonly toolbarConfig?: DataTableToolbar
  readonly searchConfig?: ComponentSearch
  readonly selectionConfig?: DataTableSelection
  readonly globalFilter: string
  readonly setGlobalFilter: (value: string) => void
  /** Forwarded to {@link SearchToolbar} — see its `onPendingChange`. */
  readonly onSearchPendingChange?: (pending: boolean) => void
  readonly importDialogOpen: boolean
  readonly onOpenImportDialog: () => void
  readonly onOpenFilterOverlay: () => void
  /**
   * Open the runtime multi-sort panel. Wired
   * to a toolbar Sort button when `toolbarConfig?.sort` is true, mirroring
   * the Filter button's plumbing.
   */
  readonly onOpenSortOverlay: () => void
  /**
   * Count of committed sort-builder rows. When > 0
   * the toolbar's Sort button renders a `data-testid="sort-badge"` span with
   * the count next to its label, mirroring `filter-badge`.
   */
  readonly activeSortCount: number
  /**
   * Active view-type. When
   * `toolbarConfig?.viewSwitcher` is true the toolbar renders one button per
   * entry of `views` — clicking one swaps what the island renders below the
   * toolbar, reflected by the `aria-pressed` attribute. The data-table island
   * itself never unmounts on a switch, so sorting + filter state survives it
   * trivially.
   */
  readonly activeView: ActiveViewType
  /** Ordered view types offered by the switcher (the config's `views`). */
  readonly views: readonly DataTableViewType[]
  /** Localizable switcher labels; each key falls back to its English default. */
  readonly viewLabels?: DataTableViewLabels
  readonly onSelectViewType: (event: React.MouseEvent<HTMLButtonElement>) => void
  /**
   * Groupable field names surfaced in the runtime group-by menu
   *. Only present when `toolbarConfig?.groupBy` is
   * true; the menu renders one `menuitem` per field plus a `None` entry to
   * clear the grouping.
   */
  readonly groupableFields: ReadonlyArray<string>
  /**
   * Active runtime grouping field, or null when no runtime grouping is set
   *. When null, the schema's static `groupBy`
   * configuration (if any) is used; setting a non-null field overrides it.
   */
  readonly runtimeGroupBy: string | null
  readonly onSelectRuntimeGroupBy: (field: string | null) => void
  readonly columnsMenuOpen: boolean
  readonly onToggleColumnsMenu: () => void
  readonly exportMenuOpen: boolean
  readonly onToggleExportMenu: () => void
  readonly onCloseExportMenu: () => void
  readonly onRefresh: () => void
  /**
   * Whether the current role may create records in the bound table
   *. When true the toolbar renders the primary
   * create button; when false the button is ABSENT (not disabled) —
   * anti-enumeration: the UI never offers an action the role cannot perform.
   */
  readonly canCreate: boolean
  /**
   * Interpreter-provided create-record label, resolved server-side
   * against the active language. Labels the create button text + its aria-label
   * so the affordance localizes ("New record" default, "Nouvel enregistrement"
   * for French, or an author override).
   */
  readonly newRecordLabel: string
  /** Open the create-record modal (only invoked when {@link canCreate}). */
  readonly onCreate: () => void
  /**
   * Read-only system-source grid.
   * When true, the CSV `Import` affordance is hidden (there is no DB table to
   * write to). Read-side controls (search / filter / sort / columns / export)
   * stay available.
   */
  readonly readOnly?: boolean
  /**
   * System read-endpoint for the CSV export.
   * When present (a read-only system source) AND `toolbar.export` is enabled, the
   * export affordance is an "Exporter" button navigating the browser to
   * `{endpoint}?format=csv` — the DB-table records-export dropdown has no table to
   * route through for a system source. Absent for a DB-table binding (unchanged).
   */
  readonly systemExportEndpoint?: string
  /**
   * Selected density label for the density menu. When unspecified the menu
   * still renders but no item is marked active.
   */
  readonly currentDensity: RowDensity
  /** Persist the chosen density (compact / normal / spacious). */
  readonly onSelectDensity: (density: RowDensity) => void
  /**
   * Reset every personal preference for this table (column widths, density,
   * column order, default view). When undefined the Settings button is
   * hidden.
   */
  readonly onResetPreferences?: () => void
  /**
   * Name of the active default view (when the user has one). Rendered as a
   * passive label in the toolbar so [internal ref]'s assertion that
   * the default view's name is visible resolves.
   */
  readonly activeViewName?: string
  readonly activeFilter: ActiveFilter | undefined
  /**
   * Count of committed filter-builder rows. When > 0
   * the toolbar's Filter button renders a `data-testid="filter-badge"` span
   * with the count next to its label.
   */
  readonly activeFilterCount: number
  readonly selectedCount: number
  readonly showSearch: boolean
  /**
   * Saved-views surface (PG-03 / [internal ref]..022). When
   * `toolbarConfig?.views` is true, render the Save view button, the Views
   * dropdown, and the Modified-indicator + companion Save / Save-as-new
   * buttons.
   *
   * `viewEntries` is the merged developer-views + personal-saved-views list
   * the Views dropdown projects. `activeViewSource` discriminates between the
   * two so the `Save` button can hide for developer views (read-only per the
   * spec's [internal ref] assertion).
   */
  readonly viewsEnabled: boolean
  readonly viewEntries: ReadonlyArray<ViewsMenuEntry>
  readonly canSaveCurrentView: boolean
  readonly isViewModified: boolean
  readonly activeViewSource: 'developer' | 'personal' | null
  readonly onOpenSaveViewDialog: () => void
  readonly onSelectView: (entry: ViewsMenuEntry) => void
  readonly onDeleteView: (entry: ViewsMenuEntry) => void
  readonly onSaveModifiedView: () => void
  /**
   * Save status to render in the toolbar. Set only when the component's
   * `saveIndicatorPosition` is `toolbar`; undefined otherwise.
   */
  readonly saveStatus?: SaveStatus
}

/**
 * Top toolbar with search + import/filter/columns/export/refresh/density buttons.
 */
export function DataTableToolbarBar({
  table,
  tableName,
  toolbarConfig,
  searchConfig,
  selectionConfig,
  globalFilter,
  setGlobalFilter,
  onSearchPendingChange,
  importDialogOpen,
  onOpenImportDialog,
  onOpenFilterOverlay,
  onOpenSortOverlay,
  activeSortCount,
  activeView,
  views,
  viewLabels,
  onSelectViewType,
  groupableFields,
  runtimeGroupBy,
  onSelectRuntimeGroupBy,
  columnsMenuOpen,
  onToggleColumnsMenu,
  exportMenuOpen,
  onToggleExportMenu,
  onCloseExportMenu,
  onRefresh,
  canCreate,
  newRecordLabel,
  onCreate,
  readOnly = false,
  systemExportEndpoint,
  currentDensity,
  onSelectDensity,
  onResetPreferences,
  activeViewName,
  activeFilter,
  activeFilterCount,
  selectedCount,
  showSearch,
  viewsEnabled,
  viewEntries,
  canSaveCurrentView,
  isViewModified,
  activeViewSource,
  onOpenSaveViewDialog,
  onSelectView,
  onDeleteView,
  onSaveModifiedView,
  saveStatus,
}: DataTableToolbarBarProps) {
  const onExportSelectedClick = useCallback(() => {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => String(row.original['id'] ?? ''))
      .filter((id) => id !== '')
    if (selectedIds.length === 0) return
    const visibleCols = getVisibleColumnIds(table)
    const hasHidden = visibleCols.length < getNonSelectColumnCount(table)
    const fieldsParam = hasHidden ? `&fields=${visibleCols.map(encodeURIComponent).join(',')}` : ''
    const idsParam = `&recordIds=${selectedIds.map(encodeURIComponent).join(',')}`
    /* eslint-disable-next-line functional/immutable-data -- imperative
       navigation is required to fire the browser-native CSV download
       from a button click while still using the existing GET endpoint */
    window.location.href = `/api/tables/${tableName}/export?format=csv${idsParam}${fieldsParam}`
  }, [table, tableName])

  return (
    <div
      role="toolbar"
      data-toolbar
      data-testid="data-table-toolbar"
      aria-hidden={importDialogOpen || undefined}
      // `flex-wrap` is load-bearing, not cosmetic: with eleven controls switched
      // on, the right-hand cluster measured 906px inside a 375px viewport and
      // the page body did not scroll — so eight of the controls were simply
      // unreachable, silently, with no wrap and no scroll affordance. Wrapping
      // costs nothing at desktop width (content that fits does not wrap) and is
      // the difference between a usable and an unusable toolbar on a phone.
      // Shared platform presentation: every business app and the Admin Space
      // draw this same toolbar, so it is fixed here rather than per app.
      className="border-border flex flex-wrap items-center gap-2 border-b p-3"
    >
      {canCreate && (
        <button
          type="button"
          aria-label={newRecordLabel}
          onClick={onCreate}
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded px-3 py-1 text-sm font-medium"
        >
          + {newRecordLabel}
        </button>
      )}
      {showSearch && searchConfig && (
        <SearchToolbar
          search={searchConfig}
          value={globalFilter}
          onChange={setGlobalFilter}
          onPendingChange={onSearchPendingChange}
        />
      )}
      {activeViewName && (
        <span
          data-testid="data-table-active-view"
          className="text-foreground-muted text-sm"
        >
          {activeViewName}
        </span>
      )}
      {toolbarConfig?.viewSwitcher && (
        <ViewSwitcher
          views={views}
          {...(viewLabels && { viewLabels })}
          activeView={activeView}
          onSelectViewType={onSelectViewType}
        />
      )}
      {saveStatus && saveStatus !== 'idle' && <SaveStatusIndicator status={saveStatus} />}
      {/* `min-w-0` lets this cluster shrink below its content width so the
          parent's wrap can take effect on it too; without it the cluster keeps
          its 906px max-content size and overflows the row it wrapped onto. */}
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        {!readOnly && (
          <button
            type="button"
            className={DROPDOWN_TRIGGER_CLASS}
            onClick={onOpenImportDialog}
          >
            Import
          </button>
        )}
        {toolbarConfig?.filters && (
          <button
            type="button"
            className="hover:bg-background-subtle inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
            aria-label="Filter"
            onClick={onOpenFilterOverlay}
          >
            Filter
            {activeFilterCount > 0 && (
              <span
                data-testid="filter-badge"
                className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
        {toolbarConfig?.sort && (
          <button
            type="button"
            className="hover:bg-background-subtle inline-flex items-center gap-1 rounded border px-3 py-1 text-sm"
            aria-label="Sort"
            onClick={onOpenSortOverlay}
          >
            Sort
            {activeSortCount > 0 && (
              <span
                data-testid="sort-badge"
                className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium"
              >
                {activeSortCount}
              </span>
            )}
          </button>
        )}
        {toolbarConfig?.groupBy && (
          <GroupMenu
            fields={groupableFields}
            current={runtimeGroupBy}
            onSelect={onSelectRuntimeGroupBy}
          />
        )}
        {viewsEnabled && (
          <>
            {/* Save view — disabled until at least one filter / sort / group is active. */}
            <button
              type="button"
              aria-label="Save view"
              disabled={!canSaveCurrentView}
              onClick={onOpenSaveViewDialog}
              className={`${DROPDOWN_TRIGGER_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Save view
            </button>
            <ViewsMenu
              views={viewEntries}
              onSelectView={onSelectView}
              onSaveCurrentView={onOpenSaveViewDialog}
              onDeleteView={onDeleteView}
            />
            {/* Modified-indicator: appears when the user has diverged from a
             * loaded saved view. The companion Save button overwrites the
             * loaded view (personal views only); `Save as new` opens the same
             * Save dialog and persists as a fresh row. */}
            {isViewModified && (
              <>
                <span
                  data-testid="view-modified-indicator"
                  className="text-foreground-muted text-xs italic"
                >
                  Modified
                </span>
                {activeViewSource === 'personal' && (
                  <button
                    type="button"
                    aria-label="Save"
                    onClick={onSaveModifiedView}
                    className={DROPDOWN_TRIGGER_CLASS}
                  >
                    Save
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Save as new"
                  onClick={onOpenSaveViewDialog}
                  className={DROPDOWN_TRIGGER_CLASS}
                >
                  Save as new
                </button>
              </>
            )}
          </>
        )}
        {toolbarConfig?.columnToggle && (
          <div className="relative">
            <button
              type="button"
              className={DROPDOWN_TRIGGER_CLASS}
              aria-label="Columns"
              onClick={onToggleColumnsMenu}
            >
              Columns
            </button>
            {columnsMenuOpen && <ColumnsMenu table={table} />}
          </div>
        )}
        {selectionConfig?.mode === 'multiple' && (
          <button
            type="button"
            className={`${DROPDOWN_TRIGGER_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
            aria-label="Export selected"
            disabled={selectedCount === 0}
            onClick={onExportSelectedClick}
          >
            Export selected
          </button>
        )}
        {toolbarConfig?.export && (
          <ExportControl
            {...(systemExportEndpoint !== undefined && { systemExportEndpoint })}
            readOnly={readOnly}
            tableName={tableName}
            table={table}
            activeFilter={activeFilter}
            exportMenuOpen={exportMenuOpen}
            onToggleExportMenu={onToggleExportMenu}
            onCloseExportMenu={onCloseExportMenu}
          />
        )}
        {toolbarConfig?.refresh && (
          <button
            type="button"
            className={DROPDOWN_TRIGGER_CLASS}
            aria-label="Refresh"
            onClick={onRefresh}
          >
            Refresh
          </button>
        )}
        {toolbarConfig?.density && (
          <DensityMenu
            current={currentDensity}
            onSelect={onSelectDensity}
          />
        )}
        {/* The Settings dialog is the per-user PREFERENCES surface, so it rides
            the flag that declares this grid has one to remember. Rendering it
            unconditionally put a "Reset to defaults" in front of every grid,
            including the ones with no preferences to reset. */}
        {toolbarConfig?.density && onResetPreferences && (
          <SettingsDialog onReset={onResetPreferences} />
        )}
      </div>
    </div>
  )
}
