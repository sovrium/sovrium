/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { ReactElement } from 'react'

interface ConflictToastProps {
  readonly conflict: DetectedConflict
  readonly onDismiss: () => void
}

const OVERWRITING_USER = 'another user'

function formatFields(fields: readonly string[]): string {
  return fields.join(', ')
}

export function ConflictToast({ conflict, onDismiss }: ConflictToastProps): ReactElement {
  const fieldList = formatFields(conflict.overwrittenFields)
  const fieldNoun = conflict.overwrittenFields.length === 1 ? 'field' : 'fields'

  return (
    <div
      role="alert"
      data-conflict-toast="true"
      className="border-warning-border bg-warning-bg text-warning-fg border-b px-4 py-2 text-sm"
    >
      <span>
        Your pending change to {fieldNoun} <strong>{fieldList}</strong> was overwritten by{' '}
        {OVERWRITING_USER}. The latest server value is now shown.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss conflict notification"
        className="text-warning-fg ml-3 rounded px-1 hover:opacity-80"
      >
        Dismiss
      </button>
    </div>
  )
}
