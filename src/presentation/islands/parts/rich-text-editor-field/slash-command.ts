/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { filterMenuItemsByToolbar, SLASH_MENU_ITEMS, TOOLBAR_ACTIONS } from './actions'
import type { Editor } from '@tiptap/react'

/**
 * Which entry a TYPED query names, if any.
 *
 * Prefix-matched on the label, which is what lets `/code` reach `Code block`
 * after four characters. Split out from the application below because the two
 * ways into this menu know different things: a reader who TYPES has given a
 * query and nothing else, while a reader who CLICKS has named an entry
 * outright and must not have that choice re-derived from whatever they had
 * typed so far — `/` alone prefix-matches the FIRST entry, so routing a click
 * back through the query would have inserted a heading whichever row was
 * pressed.
 */
export function resolveSlashToken(query: string, toolbar: readonly string[]): string | undefined {
  const lower = query.toLowerCase().trim()
  return filterMenuItemsByToolbar(SLASH_MENU_ITEMS, toolbar).find((it) =>
    it.label.toLowerCase().startsWith(lower)
  )?.token
}

/**
 * Run the action a slash-menu TOKEN names, when that token is one the field's
 * toolbar enables. Returns true when an action ran.
 *
 * The toolbar is re-checked here rather than trusted from the caller. The menu
 * is already rendered from a list filtered by it, but a token also arrives from
 * the typed path, and a menu that ran a disabled action would be a second door
 * to what the toolbar says this field does not offer.
 */
export function applySlashToken(
  editor: Editor,
  token: string,
  toolbar: readonly string[],
  onImageButtonClick: () => void
): boolean {
  const match = filterMenuItemsByToolbar(SLASH_MENU_ITEMS, toolbar).find((it) => it.token === token)
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
