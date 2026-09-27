/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo, type ReactElement, type ReactNode } from 'react'
import { resolveCurrencyOptions } from '@/domain/kernel/format/currency-format'
import { resolvePageLocale } from '../runtime/page-locale'
import { KanbanFormatContext, type KanbanFormat } from './use-kanban-format'
import type { FieldMetaMap } from '../hooks/use-inline-editing'

/** Supplies the page language and the footer columns' currency treatment to every card. */
export function KanbanFormatProvider({
  fieldMeta,
  children,
}: {
  readonly fieldMeta: FieldMetaMap | undefined
  readonly children: ReactNode
}): ReactElement {
  const value = useMemo<KanbanFormat>(
    () => ({
      locale: resolvePageLocale(),
      currencyOptionsFor: (field) => resolveCurrencyOptions(fieldMeta?.[field]),
    }),
    [fieldMeta]
  )
  return <KanbanFormatContext.Provider value={value}>{children}</KanbanFormatContext.Provider>
}
