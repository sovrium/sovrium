/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableToolbarButtonClasses } from '@/presentation/design/table-default-classes'
import { useGridString } from '../grid-strings'

interface BadgeButtonProps {
  /** Doubles as the button's visible text and its accessible name. */
  readonly label: string
  readonly badgeTestId: string
  /** Committed builder rows; the badge is suppressed at zero. */
  readonly count: number
  readonly onClick: () => void
}

/**
 * A toolbar button carrying a count badge — the Filter and Sort openers, which
 * differ only in their label, their badge's test id, and what they open.
 *
 * The badge keeps its shape (a 16px circle that grows with a two-digit count)
 * and loses its arbitrary `text-[10px]` for the ladder's own 11px rung. The
 * literal was below every step the platform declares, so it was the one piece
 * of type in the grid that could not move when the ladder did.
 */
function BadgeButton({ label, badgeTestId, count, onClick }: BadgeButtonProps) {
  return (
    <button
      type="button"
      className={`${computeTableToolbarButtonClasses({ active: count > 0 })} inline-flex items-center gap-1`}
      aria-label={label}
      onClick={onClick}
    >
      {label}
      {count > 0 && (
        <span
          data-testid={badgeTestId}
          className="bg-primary text-primary-fg inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-medium"
        >
          {count}
        </span>
      )}
    </button>
  )
}

/**
 * The controls that change WHICH rows the grid is asking for: the CSV import
 * entry point plus the filter / sort / group-by openers.
 */
export interface QueryControlsProps {
  /**
   * Whether Import is offered. Import writes records, so it follows the same
   * `create` gate as `+ New record` — a caller the table's `create` grant does
   * not admit is shown no Import rather than a control the server refuses —
   * and it is hidden on a read-only system-source grid, whose rows come from a
   * read endpoint with no DB table to import into.
   */
  readonly canImport: boolean
  readonly onOpenImportDialog: () => void
  readonly filtersEnabled: boolean
  readonly onOpenFilterOverlay: () => void
  readonly activeFilterCount: number
  readonly sortEnabled: boolean
  readonly onOpenSortOverlay: () => void
  readonly activeSortCount: number
}

/**
 * The three captions below are the grid's own words, not the author's, so they
 * come from the interpreter catalog in the page's language
 * (`datatable.import` / `.filter` / `.sort`) — « Importer · Filtrer · Trier »
 * on a French page — through the same channel as the rest of the toolbar.
 */
export function QueryControls(props: QueryControlsProps) {
  const captions = {
    importRows: useGridString('datatable.import', 'Import'),
    filter: useGridString('datatable.filter', 'Filter'),
    sort: useGridString('datatable.sort', 'Sort'),
  }
  return (
    <>
      {props.canImport && (
        <button
          type="button"
          className={computeTableToolbarButtonClasses()}
          onClick={props.onOpenImportDialog}
        >
          {captions.importRows}
        </button>
      )}
      {props.filtersEnabled && (
        <BadgeButton
          label={captions.filter}
          badgeTestId="filter-badge"
          count={props.activeFilterCount}
          onClick={props.onOpenFilterOverlay}
        />
      )}
      {props.sortEnabled && (
        <BadgeButton
          label={captions.sort}
          badgeTestId="sort-badge"
          count={props.activeSortCount}
          onClick={props.onOpenSortOverlay}
        />
      )}
    </>
  )
}
