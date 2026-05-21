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
        className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onPaste}
        disabled={isPasting}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPasting ? 'Pasting…' : 'Paste'}
      </button>
    </div>
  )
}
