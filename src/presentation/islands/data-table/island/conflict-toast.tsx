/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Conflict toast for the realtime data-table island.
 *
 * Rendered when a concurrent edit overwrites a field
 * the current user could already see. The toast is an `alert` so assistive
 * tech announces it immediately; its text names every overwritten field and
 * the user whose write won, then explains the data has been reconciled to the
 * server's authoritative state (server-wins — [internal ref]).
 */

import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { ReactElement } from 'react'

interface ConflictToastProps {
  readonly conflict: DetectedConflict
  readonly onDismiss: () => void
}

/**
 * Direct database writes (and SSE change events that do not attribute a
 * writer) have no identifiable author — the toast falls back to a generic
 * label so the message still reads naturally.
 */
const OVERWRITING_USER = 'another user'

/** Join field names into a readable, comma-separated clause. */
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
