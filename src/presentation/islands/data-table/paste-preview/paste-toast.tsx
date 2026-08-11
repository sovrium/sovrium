/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
      className="bg-foreground text-background fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg"
    >
      <span>{created} records created</span>
      <button
        type="button"
        onClick={onUndo}
        disabled={isUndoing}
        // eslint-disable-next-line no-restricted-syntax -- bg-white/10 + hover:bg-white/20 are translucent overlays on the dark inverse toast surface (bg-foreground text-background parent); no canonical translucent role token exists for this case
        className="rounded bg-white/10 px-2 py-1 text-xs font-medium hover:bg-white/20 disabled:opacity-50"
      >
        {isUndoing ? 'Undoing…' : 'Undo'}
      </button>
    </div>
  )
}
