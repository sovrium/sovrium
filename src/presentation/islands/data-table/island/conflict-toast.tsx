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

import {
  computeTableActionButtonClasses,
  computeTableToastClasses,
} from '@/presentation/design/table-default-classes'
import { useGridString } from './grid-strings'
import type { DetectedConflict } from '../../hooks/use-realtime-reconciliation'
import type { ReactElement } from 'react'

interface ConflictToastProps {
  readonly conflict: DetectedConflict
  readonly onDismiss: () => void
}

/** The sentence, one field then several; `{fields}` drawn strong, `{writer}` who won. */
const ONE_FIELD =
  'Your pending change to field {fields} was overwritten by {writer}. The latest server value is now shown.'
const SEVERAL_FIELDS =
  'Your pending change to fields {fields} was overwritten by {writer}. The latest server value is now shown.'

/** Join field names into a readable, comma-separated clause. */
function formatFields(fields: readonly string[]): string {
  return fields.join(', ')
}

export function ConflictToast({ conflict, onDismiss }: ConflictToastProps): ReactElement {
  const fieldList = formatFields(conflict.overwrittenFields)
  const one = useGridString('datatable.conflict', ONE_FIELD)
  const several = useGridString('datatable.conflictFields', SEVERAL_FIELDS)
  // Direct database writes (and SSE change events that do not attribute a
  // writer) have no identifiable author — a generic label keeps it readable.
  const writer = useGridString('datatable.anotherUser', 'another user')
  const dismissName = useGridString('datatable.dismissConflict', 'Dismiss conflict notification')
  const dismiss = useGridString('datatable.dismiss', 'Dismiss')
  const [before = '', after = ''] = (conflict.overwrittenFields.length === 1 ? one : several)
    .split('{writer}')
    .join(writer)
    .split('{fields}')

  return (
    <div
      role="alert"
      data-conflict-toast="true"
      // A TOAST, not a band. The three strips beside it report a standing
      // condition of the grid — a stalled connection, an unsaved edit — and
      // stay full-width bands for that reason; this one reports a single event
      // that has already happened to one record, and is dismissed. The tone
      // moves with the shape: the soft error pair, because a write the reader
      // made did not survive, where `warning` says something might go wrong.
      className={`${computeTableToastClasses({ tone: 'error' })} m-2`}
    >
      <span>
        {before}
        <strong>{fieldList}</strong>
        {after}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={dismissName}
        className={computeTableActionButtonClasses()}
      >
        {dismiss}
      </button>
    </div>
  )
}
