/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

interface PasteDialogFooterProps {
  readonly isPasting: boolean
  readonly onPaste: () => void
  readonly onCancel: () => void
}

export function PasteDialogFooter({ isPasting, onPaste, onCancel }: PasteDialogFooterProps) {
  return (
    <div className="mt-4 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="border-border text-foreground hover:bg-background-subtle rounded border px-4 py-2 text-sm"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onPaste}
        disabled={isPasting}
        className="bg-primary text-primary-fg hover:bg-primary-hover rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {isPasting ? 'Pasting…' : 'Paste'}
      </button>
    </div>
  )
}
