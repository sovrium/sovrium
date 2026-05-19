/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterMenuItemsByToolbar, SLASH_MENU_ITEMS, TOOLBAR_ACTIONS } from './actions'
import type { Editor } from '@tiptap/react'

export function applySlashCommand(
  editor: Editor,
  query: string,
  toolbar: readonly string[],
  onImageButtonClick: () => void
): boolean {
  const lower = query.toLowerCase().trim()
  const filteredItems = filterMenuItemsByToolbar(SLASH_MENU_ITEMS, toolbar)
  const match = filteredItems.find((it) => it.label.toLowerCase().startsWith(lower))
  if (!match) return false
  if (match.token === 'image') {
    onImageButtonClick()
    return true
  }
  const def = TOOLBAR_ACTIONS[match.token]
  if (!def?.action) return false
  def.action(editor)
  return true
}
