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
    <div className="border-border bg-primary-subtle flex items-center gap-2 border-b px-3 py-2">
      <span className="text-fg text-sm">{selectedCount} selected</span>
      {!confirmAction &&
        bulkActions.map((action, i) => (
          <button
            key={i}
            type="button"
            className="bg-bg-subtle hover:bg-bg-subtle rounded px-3 py-1 text-sm"
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
        <div className="border-warning-border bg-warning-bg ml-2 rounded border px-3 py-1 text-sm">
          {confirmAction.confirm.replace('{count}', String(selectedCount))}
          <button
            type="button"
            className="text-success-fg ml-2 font-medium hover:underline"
            onClick={() => {
              onExecute(confirmAction)
              setConfirmAction(undefined)
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            className="text-primary ml-2 hover:underline"
            onClick={() => setConfirmAction(undefined)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
