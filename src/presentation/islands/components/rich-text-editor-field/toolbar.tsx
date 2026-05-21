/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
      className="flex flex-wrap gap-1 border-b p-1"
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
            aria-label={def.ariaLabel}
            onClick={onClick}
            className={`rounded px-2 py-1 text-xs font-medium ${
              active ? 'bg-bg-subtle text-fg' : 'text-fg-muted hover:bg-bg-subtle'
            }`}
          >
            {def.label}
          </button>
        )
      })}
    </div>
  )
}
