/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createContext, useContext } from 'react'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'

/**
 * What a card needs to format its footer the way the grid formats a cell: the
 * page's language, and each column's declared currency treatment.
 *
 * A context rather than a prop because the card sits five components below the
 * island on either board shape (row, or lane grid), and threading two more
 * props through every level to reach one leaf is what `colorFieldColors`
 * already costs. {@link KanbanFormatProvider} supplies it.
 */
export interface KanbanFormat {
  /** The page's language, read from `<html lang>` (`meta.lang`). */
  readonly locale: string
  /** Look up the currency treatment a column declares, if it declares one. */
  readonly currencyOptionsFor: (field: string) => CurrencyDisplayOptions | undefined
}

export const KanbanFormatContext = createContext<KanbanFormat>({
  locale: 'en-US',
  currencyOptionsFor: () => undefined,
})

export function useKanbanFormat(): KanbanFormat {
  return useContext(KanbanFormatContext)
}
