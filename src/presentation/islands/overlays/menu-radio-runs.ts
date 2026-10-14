/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MenuItem } from './menu-item-types'

/**
 * A menu's rows with their radio runs gathered: a run of CONSECUTIVE rows
 * naming the same `radioGroup` becomes one radio entry, drawn as one Base UI
 * radio group by `RadioMenuGroup` (`menu-radio-entries.tsx`).
 */

/** One entry of a menu once its radio runs are gathered. */
export type MenuEntry =
  | { readonly kind: 'item'; readonly item: MenuItem; readonly index: number }
  | {
      readonly kind: 'radio'
      readonly group: string
      readonly rows: readonly { readonly item: MenuItem; readonly index: number }[]
    }

/** Gather the consecutive rows sharing a `radioGroup` into one radio entry. */
export function gatherMenuEntries(items: readonly MenuItem[]): readonly MenuEntry[] {
  return items.reduce<readonly MenuEntry[]>((entries, item, index) => {
    const group = item.separator === true ? undefined : item.radioGroup
    const last = entries.at(-1)
    if (group === undefined) return [...entries, { kind: 'item', item, index }]
    if (last?.kind === 'radio' && last.group === group) {
      return [...entries.slice(0, -1), { ...last, rows: [...last.rows, { item, index }] }]
    }
    return [...entries, { kind: 'radio', group, rows: [{ item, index }] }]
  }, [])
}
