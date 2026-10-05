/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'

/**
 * What a card needs from the board to draw itself: the page's language, each
 * footer column's declared currency treatment, the colour-field hues, the
 * bound table and whether it may be dragged.
 *
 * A context rather than props because the card sits five components below the
 * island on either board shape (row, or lane grid), and every value here is
 * read by that one leaf alone — threading each through every level is bytes
 * the board's per-island budget pays for nothing. {@link KanbanFormatProvider}
 * supplies it.
 */
export interface KanbanFormat {
  /** The page's language, read from `<html lang>` (`meta.lang`). */
  readonly locale: string
  /** Look up the currency treatment a column declares, if it declares one. */
  readonly currencyOptionsFor: (field: string) => CurrencyDisplayOptions | undefined
  /** The footer columns' metadata, carrying each option badge's paints by value. */
  readonly fieldMeta?: FieldMetaMap
  /** The board's bound table, named in a card's `openDrawer` like a grid row's. */
  readonly table?: string
  /** `optionValue → #RRGGBB` declared on the field `card.colorField` names. */
  readonly colorFieldColors?: Readonly<Record<string, string>>
  /** Whether a card may be picked up — the board's resolved drag gate. */
  readonly draggableEnabled?: boolean
}

export const KanbanFormatContext = createContext<KanbanFormat>({
  locale: 'en-US',
  currencyOptionsFor: () => undefined,
})

export function useKanbanFormat(): KanbanFormat {
  return useContext(KanbanFormatContext)
}
