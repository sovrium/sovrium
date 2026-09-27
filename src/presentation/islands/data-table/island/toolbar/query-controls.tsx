/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableToolbarButtonClasses } from '@/presentation/design/table-default-classes'
import { resolvePageLocale } from '../../../runtime/page-locale'
import { GroupMenu } from '../group-menu'

interface QueryCaptions {
  readonly importRows: string
  readonly filter: string
  readonly sort: string
}

/**
 * The captions the grid writes ITSELF, by primary language subtag of the page
 * (`<html lang>` ← `meta.lang`). Everything else on a grid — column labels, the
 * search placeholder, the empty message — is authored, so it is already in the
 * page's language; these three words are the grid's own, and on a French page
 * they read « Importer · Filtrer · Trier » rather than English above French
 * headers. A language not listed keeps the English captions.
 */
const QUERY_CAPTIONS: Readonly<Record<string, QueryCaptions>> = {
  en: { importRows: 'Import', filter: 'Filter', sort: 'Sort' },
  fr: { importRows: 'Importer', filter: 'Filtrer', sort: 'Trier' },
}

function resolveQueryCaptions(): QueryCaptions {
  const language = resolvePageLocale().split('-')[0]?.toLowerCase() ?? 'en'
  return QUERY_CAPTIONS[language] ?? QUERY_CAPTIONS['en']!
}

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
  readonly groupByEnabled: boolean
  /** Groupable field names surfaced in the runtime group-by menu. */
  readonly groupableFields: ReadonlyArray<string>
  /**
   * Active runtime grouping field, or null when none is set — in which case the
   * schema's static `groupBy` applies.
   */
  readonly runtimeGroupBy: string | null
  readonly onSelectRuntimeGroupBy: (field: string | null) => void
}

export function QueryControls(props: QueryControlsProps) {
  const captions = resolveQueryCaptions()
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
      {props.groupByEnabled && (
        <GroupMenu
          fields={props.groupableFields}
          current={props.runtimeGroupBy}
          onSelect={props.onSelectRuntimeGroupBy}
        />
      )}
    </>
  )
}
