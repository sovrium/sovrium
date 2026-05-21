/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SaveStatus } from '../hooks/use-inline-editing'
import type { ReactElement } from 'react'


function statusLabel(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'Saving...'
    case 'saved':
      return 'Saved'
    case 'error':
      return 'Error saving'
    case 'idle':
      return ''
  }
}

function statusColorClass(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'text-gray-500'
    case 'saved':
      return 'text-green-600'
    case 'error':
      return 'text-red-600'
    case 'idle':
      return ''
  }
}

interface SaveStatusIndicatorProps {
  readonly status: SaveStatus
  readonly className?: string
}

export function SaveStatusIndicator({
  status,
  className,
}: SaveStatusIndicatorProps): ReactElement | undefined {
  if (status === 'idle') return undefined

  return (
    <span
      role="status"
      data-save-indicator
      data-save-status={status}
      className={`inline-flex items-center text-xs font-medium ${statusColorClass(status)} ${
        className ?? ''
      }`}
    >
      {statusLabel(status)}
    </span>
  )
}
