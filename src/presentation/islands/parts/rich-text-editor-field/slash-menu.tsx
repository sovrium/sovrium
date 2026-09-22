/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import {
  computeRichTextSlashEmptyClasses,
  computeRichTextSlashItemClasses,
  computeRichTextSlashMenuClasses,
} from '@/presentation/design/rich-text-editor-default-classes'
import type { SlashMenuItem } from './actions'
import type { MouseEvent as ReactMouseEvent } from 'react'

/**
 * What the menu needs from the editor: whether it is showing, what has been
 * typed after the slash, and how to answer it.
 */
export interface SlashMenuController {
  readonly visible: boolean
  readonly query: string
  /** Answer the menu with one entry — see `useSlashMenu`. */
  readonly selectItem: (token: string) => void
}

interface SlashMenuProps {
  readonly state: SlashMenuController
  readonly items: readonly SlashMenuItem[]
}

/**
 * One entry.
 *
 * Its own component because the press handler closes over the entry's token,
 * and an arrow written inline in the parent's `.map()` is a fresh function per
 * entry per render.
 *
 * ─── MOUSEDOWN, AND PREVENTED ──────────────────────────────────────────────
 *
 * The menu is not inside the editable body, so a press on it would blur the
 * editor and drop the selection — and the selection is exactly what answering
 * needs, since it means deleting the `/<query>` sitting just behind the caret.
 * `preventDefault` on `mousedown` is what stops the browser moving focus at
 * all, and doing the work there rather than on `click` runs the action while
 * the caret is still where the reader left it.
 */
function SlashMenuEntry({
  item,
  onSelect,
}: {
  readonly item: SlashMenuItem
  readonly onSelect: (token: string) => void
}) {
  const press = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      onSelect(item.token)
    },
    [onSelect, item.token]
  )
  return (
    <div
      role="option"
      aria-selected="false"
      data-slash-menu-item={item.token}
      className={computeRichTextSlashItemClasses()}
      onMouseDown={press}
    >
      {item.label}
    </div>
  )
}

export function SlashMenu({ state, items }: SlashMenuProps) {
  if (!state.visible) return undefined
  const matches = items.filter((it) => it.label.toLowerCase().includes(state.query.toLowerCase()))
  return (
    <div
      data-slash-menu
      role="listbox"
      className={computeRichTextSlashMenuClasses()}
    >
      {matches.length === 0 ? (
        <div className={computeRichTextSlashEmptyClasses()}>No matches</div>
      ) : (
        matches.map((it) => (
          <SlashMenuEntry
            key={it.token}
            item={it}
            onSelect={state.selectItem}
          />
        ))
      )}
    </div>
  )
}
