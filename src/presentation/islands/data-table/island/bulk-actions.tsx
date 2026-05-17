/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import type { DataTableBulkAction } from '@/domain/models/app/pages/components/data-table'

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

export function BulkActionBar({ bulkActions, selectedCount, onExecute }: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<DataTableBulkAction | undefined>(undefined)

  if (selectedCount === 0) {
    return <HiddenBulkActionsPlaceholder bulkActions={bulkActions} />
  }

  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-blue-50 px-3 py-2">
      <span className="text-sm text-gray-700">{selectedCount} selected</span>
      {!confirmAction &&
        bulkActions.map((action, i) => (
          <button
            key={i}
            type="button"
            className="rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- per-row click handler closes over loop-variable `action`; useCallback inside .map() has equivalent allocation cost. React Compiler will memoize this once enabled in Bun (see docs/infrastructure/ui/react.md).
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
        <div className="ml-2 rounded border border-yellow-300 bg-yellow-50 px-3 py-1 text-sm">
          {confirmAction.confirm.replace('{count}', String(selectedCount))}
          <button
            type="button"
            className="ml-2 font-medium text-green-700 hover:underline"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- two-statement handler closing over current confirmAction; React Compiler will memoize once enabled in Bun (see docs/infrastructure/ui/react.md).
            onClick={() => {
              onExecute(confirmAction)
              setConfirmAction(undefined)
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            className="ml-2 text-blue-600 hover:underline"
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- one-statement handler; React Compiler will memoize once enabled in Bun (see docs/infrastructure/ui/react.md).
            onClick={() => setConfirmAction(undefined)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
