/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeTableToolbarPrimaryButtonClasses } from '@/presentation/design/table-default-classes'
import { SaveStatusIndicator } from '../../save-status-indicator'
import { SearchToolbar } from './search-toolbar'
import type { SaveStatus } from '../../../hooks/use-inline-editing'
import type { ComponentSearch } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * The toolbar's leading cluster: what the operator does to the grid (create,
 * search) and its save state. Everything that acts on the ROWS lives in the
 * trailing cluster.
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
      {props.saveStatus && props.saveStatus !== 'idle' && (
        <SaveStatusIndicator status={props.saveStatus} />
      )}
    </>
  )
}
