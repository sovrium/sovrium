/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableActionButtonClasses,
  computeTableToastClasses,
} from '@/presentation/design/table-default-classes'

interface PasteToastProps {
  /** Number of records created by the completed paste. */
  readonly created: number
  /** Whether the Undo action is currently in flight. */
  readonly isUndoing: boolean
  /** Reverts the paste by deleting the created records. */
  readonly onUndo: () => void
}

/**
 * Confirmation toast shown after a successful paste import.
 *
 * Reports the created-record count and offers an Undo action that deletes the
 * just-created records. Carries `role="status"` so assistive tech (and the
 * E2E specs) can locate it.
 */
export function PasteToast({ created, isUndoing, onUndo }: PasteToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      // Position stays here; the surface is the grid's shared toast. It used to
      // be an INVERTED slab — the foreground colour used as a fill — which is
      // the one treatment the design reserves for a tooltip, and which forced
      // its own button to invent a translucent white overlay, because no token
      // exists for a control sitting on inverted ground. Those two overlays were
      // the last raw palette colours anywhere in the grid.
      className={`${computeTableToastClasses()} fixed bottom-4 left-1/2 z-50 -translate-x-1/2`}
    >
      <span>{created} records created</span>
      <button
        type="button"
        onClick={onUndo}
        disabled={isUndoing}
        className={computeTableActionButtonClasses({ disabled: isUndoing })}
      >
        {isUndoing ? 'Undoing…' : 'Undo'}
      </button>
    </div>
  )
}
