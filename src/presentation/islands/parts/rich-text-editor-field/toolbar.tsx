/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeRichTextToolbarButtonClasses,
  computeRichTextToolbarClasses,
} from '@/presentation/design/rich-text-editor-default-classes'
import { TOOLBAR_ACTIONS } from './actions'
import type { Editor } from '@tiptap/react'

interface ToolbarProps {
  readonly editor: Editor | null
  readonly items: readonly string[]
  readonly onImageButtonClick: () => void
}

export function Toolbar({ editor, items, onImageButtonClick }: ToolbarProps) {
  if (!editor) return undefined

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className={computeRichTextToolbarClasses()}
    >
      {items.map((item) => {
        const def = TOOLBAR_ACTIONS[item]
        if (!def) return undefined
        const active = def.isActive?.(editor) ?? false
        const onClick = item === 'image' ? onImageButtonClick : () => def.action?.(editor)
        return (
          <button
            key={item}
            type="button"
            // The action's own token, beside the human `aria-label`. A spec
            // asserting WHICH actions a toolbar offers — and in what order —
            // has to address them by something stable, and the label is
            // sentence text that a translation or a rewording moves.
            data-rte-action={item}
            aria-label={def.ariaLabel}
            onClick={onClick}
            className={computeRichTextToolbarButtonClasses({ active })}
          >
            {def.label}
          </button>
        )
      })}
    </div>
  )
}
