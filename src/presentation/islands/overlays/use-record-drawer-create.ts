/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The gesture that opens a record sheet to CREATE a record: a page button whose
 * action is `{ action: 'openSheet', component: <sheet id> }`.
 *
 * Every other way a sheet opens names a record — a row, a card, an event, a
 * related row all dispatch the one clicked, and an address carries its id. A
 * button carries none, so "opened with no record" is the create gesture and no
 * key says it. The button is drawn with `data-click-modal=<id>`; the
 * page's click runtime marks the press in `window.__sovriumOpenModals` when it
 * lands before this lazy island has mounted, and the press is replayed here.
 */

import { useEffect } from 'react'

/** Take a press that landed before the island mounted, once. */
function consumePendingPress(id: string): boolean {
  const pending = (window as { __sovriumOpenModals?: Record<string, boolean> }).__sovriumOpenModals
  return pending?.[id] === true && Reflect.deleteProperty(pending, id)
}

/** Open the sheet `id` in create mode on every press of a button that names it. */
export function useCreateTrigger(
  id: string | undefined,
  table: string | undefined,
  startCreate: () => void
): void {
  useEffect(() => {
    if (!id || !table || typeof document === 'undefined') return undefined
    if (consumePendingPress(id)) startCreate()
    const onClick = (event: Event): void => {
      const target = event.target as Element | null
      if (target?.closest?.(`[data-click-modal="${CSS.escape(id)}"]`)) {
        startCreate()
        // The page's click runtime may mark the same press after this listener
        // ran; take the mark once both have, so it is never replayed later.
        setTimeout(() => consumePendingPress(id), 0)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [id, table, startCreate])
}
