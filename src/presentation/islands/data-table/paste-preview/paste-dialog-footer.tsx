/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeTableEditorFooterClasses } from '@/presentation/design/table-default-classes'

interface PasteDialogFooterProps {
  /** Whether the batch create is in flight. */
  readonly isPasting: boolean
  /** Confirms the import. */
  readonly onPaste: () => void
  /** Dismisses the dialog without importing. */
  readonly onCancel: () => void
}

/** Cancel / Paste action row for the paste-preview dialog. */
export function PasteDialogFooter({ isPasting, onPaste, onCancel }: PasteDialogFooterProps) {
  return (
    <div className={computeTableEditorFooterClasses()}>
      <button
        type="button"
        onClick={onCancel}
        className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onPaste}
        disabled={isPasting}
        className={computeButtonDefaultClasses({ variant: 'default', size: 'sm' })}
      >
        {isPasting ? 'Pasting…' : 'Paste'}
      </button>
    </div>
  )
}
