/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTablePanelCaptionClasses,
  computeTableToolbarPrimaryButtonClasses,
} from '@/presentation/design/table-default-classes'
import { SaveStatusIndicator } from '../../save-status-indicator'
import { ViewSwitcher } from '../view-switcher'
import { SearchToolbar } from './search-toolbar'
import type { SaveStatus } from '../../../hooks/use-inline-editing'
import type { ActiveViewType } from '../use-ui-state'
import type {
  ComponentSearch,
  DataTableViewLabels,
  DataTableViewType,
} from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The toolbar's leading cluster: what the operator does to the grid (create,
 * search) and what the grid currently is (active view name, view type, save
 * state). Everything that acts on the ROWS lives in the trailing cluster.
 */
export interface LeadingControlsProps {
  /**
   * Whether the current role may create records in the bound table. When false
   * the button is ABSENT (not disabled) — anti-enumeration: the UI never offers
   * an action the role cannot perform.
   */
  readonly canCreate: boolean
  /**
   * Interpreter-provided create-record label, resolved server-side against the
   * active language. Labels the create button text + its aria-label.
   */
  readonly newRecordLabel: string
  /** Open the create-record modal (only invoked when {@link canCreate}). */
  readonly onCreate: () => void
  readonly showSearch: boolean
  readonly searchConfig?: ComponentSearch
  readonly globalFilter: string
  readonly setGlobalFilter: (value: string) => void
  /** Forwarded to {@link SearchToolbar} — see its `onPendingChange`. */
  readonly onSearchPendingChange?: (pending: boolean) => void
  /**
   * Name of the active default view (when the user has one). Rendered as a
   * passive label so the "default view's name is visible" assertion resolves.
   */
  readonly activeViewName?: string
  readonly viewSwitcherEnabled: boolean
  /** Active view-type; the switcher reflects it via `aria-pressed`. */
  readonly activeView: ActiveViewType
  /** Ordered view types offered by the switcher (the config's `views`). */
  readonly views: readonly DataTableViewType[]
  /** Localizable switcher labels; each key falls back to its English default. */
  readonly viewLabels?: DataTableViewLabels
  readonly onSelectViewType: (event: React.MouseEvent<HTMLButtonElement>) => void
  /**
   * Save status to render in the toolbar. Set only when the component's
   * `saveIndicatorPosition` is `toolbar`; undefined otherwise.
   */
  readonly saveStatus?: SaveStatus
}

export function LeadingControls(props: LeadingControlsProps) {
  return (
    <>
      {props.canCreate && (
        <button
          type="button"
          aria-label={props.newRecordLabel}
          onClick={props.onCreate}
          className={computeTableToolbarPrimaryButtonClasses()}
        >
          + {props.newRecordLabel}
        </button>
      )}
      {props.showSearch && props.searchConfig && (
        <SearchToolbar
          search={props.searchConfig}
          value={props.globalFilter}
          onChange={props.setGlobalFilter}
          onPendingChange={props.onSearchPendingChange}
        />
      )}
      {props.activeViewName && (
        // The active view's name is a CAPTION on the bar, not a control: it
        // reports what the reader is looking at and cannot be clicked. It takes
        // the panels' caption tone for that reason, one step below the buttons
        // beside it rather than the 14px it used to share with them.
        <span
          data-testid="data-table-active-view"
          className={`text-xs ${computeTablePanelCaptionClasses()}`}
        >
          {props.activeViewName}
        </span>
      )}
      {props.viewSwitcherEnabled && (
        <ViewSwitcher
          views={props.views}
          viewLabels={props.viewLabels}
          activeView={props.activeView}
          onSelectViewType={props.onSelectViewType}
        />
      )}
      {props.saveStatus && props.saveStatus !== 'idle' && (
        <SaveStatusIndicator status={props.saveStatus} />
      )}
    </>
  )
}
