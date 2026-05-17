/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { SlashMenuItem } from './actions'

export interface SlashMenuState {
  readonly visible: boolean
  readonly query: string
}

interface SlashMenuProps {
  readonly state: SlashMenuState
  readonly items: readonly SlashMenuItem[]
}

export function SlashMenu({ state, items }: SlashMenuProps) {
  if (!state.visible) return undefined
  const matches = items.filter((it) => it.label.toLowerCase().includes(state.query.toLowerCase()))
  return (
    <div
      data-slash-menu
      role="listbox"
      className="absolute z-10 rounded border bg-white p-1 text-sm shadow-md"
    >
      {matches.length === 0 ? (
        <div className="px-2 py-1 text-gray-400">No matches</div>
      ) : (
        matches.map((it) => (
          <div
            key={it.token}
            role="option"
            aria-selected="false"
            data-slash-menu-item={it.token}
            className="cursor-pointer px-2 py-1 hover:bg-gray-100"
          >
            {it.label}
          </div>
        ))
      )}
    </div>
  )
}
