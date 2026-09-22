/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import {
  computeTableBulkBarClasses,
  computeTableBulkBarCountClasses,
  computeTablePanelCaptionClasses,
  computeTableToolbarButtonClasses,
  computeTableToolbarPrimaryButtonClasses,
} from '@/presentation/design/table-default-classes'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/component-types/data/table/schema'

interface BulkActionBarProps {
  readonly bulkActions: readonly DataTableBulkAction[]
  readonly selectedCount: number
  readonly onExecute: (action: DataTableBulkAction) => void
}

/**
 * Hidden placeholder rendered while no rows are selected.
 *
 * The bulk-action buttons must remain present in the DOM so that E2E specs
 * targeting them by `getByRole('button', { name: ... })` resolve before the
 * user makes any selection (the buttons are revealed when selection becomes
 * non-empty).
 */
function HiddenBulkActionsPlaceholder({
  bulkActions,
}: {
  readonly bulkActions: readonly DataTableBulkAction[]
}) {
  return (
    <div
      className="hidden"
      aria-hidden="true"
    >
      {bulkActions.map((action, i) => (
        <button
          key={i}
          type="button"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

/**
 * The bar that appears above the header row once rows are selected.
 *
 * ## The confirm prompt asks quietly and answers with a button
 * It used to sit inside a bordered `warning-bg` gate with the confirm drawn as
 * a green link — three signals for one question, and the loudest of them
 * spending the reserved colour on an outcome that had not happened yet. It now
 * asks with a right-aligned muted caption and answers with the one primary
 * button on the bar, keeping colour for a FAILURE.
 */
export function BulkActionBar({ bulkActions, selectedCount, onExecute }: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<DataTableBulkAction | undefined>(undefined)

  if (selectedCount === 0) {
    return <HiddenBulkActionsPlaceholder bulkActions={bulkActions} />
  }

  return (
    <div className={computeTableBulkBarClasses()}>
      <span className={computeTableBulkBarCountClasses()}>{selectedCount} selected</span>
      {!confirmAction &&
        bulkActions.map((action, i) => (
          <button
            key={i}
            type="button"
            className={computeTableToolbarButtonClasses()}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- per-row click handler closes over loop-variable `action`; useCallback inside.map has equivalent allocation cost. React Compiler will memoize this once enabled in Bun.
            onClick={() => {
              if (action.confirm) {
                setConfirmAction(action)
              } else {
                onExecute(action)
              }
            }}
          >
            {action.label}
          </button>
        ))}
      {confirmAction && confirmAction.confirm && (
        <div className={`ml-auto flex items-center gap-2 ${computeTablePanelCaptionClasses()}`}>
          {confirmAction.confirm.replace('{count}', String(selectedCount))}
          <button
            type="button"
            className={computeTableToolbarPrimaryButtonClasses()}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- two-statement handler closing over current confirmAction; React Compiler will memoize once enabled in Bun.
            onClick={() => {
              onExecute(confirmAction)
              setConfirmAction(undefined)
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            className={computeTableToolbarButtonClasses()}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- one-statement handler; React Compiler will memoize once enabled in Bun.
            onClick={() => setConfirmAction(undefined)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
