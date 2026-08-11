/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cn } from '@/presentation/utils/design/class-merge'
import type { SaveStatus } from '../hooks/use-inline-editing'
import type { ReactElement } from 'react'

// ---------------------------------------------------------------------------
// Save status indicator
// ---------------------------------------------------------------------------

/** Human-readable label for each non-idle save status. */
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

/** Tailwind text-color class for each non-idle save status. */
function statusColorClass(status: SaveStatus): string {
  switch (status) {
    case 'saving':
      return 'text-foreground-muted'
    case 'saved':
      return 'text-success-fg'
    case 'error':
      return 'text-error-fg'
    case 'idle':
      return ''
  }
}

interface SaveStatusIndicatorProps {
  readonly status: SaveStatus
  /** Extra class names for layout (e.g. positioning in the toolbar). */
  readonly className?: string
}

/**
 * Renders the auto-save status (Saving... / Saved / Error) for an editable
 * component. Hidden entirely when the status is `idle` so a successful save
 * indicator auto-dismisses.
 *
 * Marked with `data-save-indicator` for inline-position lookups and exposes
 * `role="status"` so it surfaces to assistive tech and the toast position.
 */
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
      className={cn(
        'inline-flex items-center text-xs font-medium',
        statusColorClass(status),
        className
      )}
    >
      {statusLabel(status)}
    </span>
  )
}
