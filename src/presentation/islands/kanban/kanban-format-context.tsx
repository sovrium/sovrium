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
import type { RecordTextFields } from '@/domain/models/app/tables/record-text-service'

/**
 * Supplies the page language, the footer columns' currency treatment, the
 * colour-field hues, the board's bound table and its drag gate to every card.
 */
export function KanbanFormatProvider({
  fieldMeta,
  table,
  colorFieldColors,
  draggableEnabled,
  recordText,
  children,
}: {
  readonly fieldMeta: FieldMetaMap | undefined
  readonly table: string | undefined
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
  readonly draggableEnabled: boolean
  readonly recordText: RecordTextFields | undefined
  readonly children: ReactNode
}): ReactElement {
  const value = useMemo<KanbanFormat>(
    () => ({
      locale: resolvePageLocale(),
      currencyOptionsFor: (field) => resolveCurrencyOptions(fieldMeta?.[field]),
      fieldMeta,
      ...(table ? { table } : {}),
      ...(colorFieldColors ? { colorFieldColors } : {}),
      draggableEnabled,
      ...(recordText ? { recordText } : {}),
    }),
    [fieldMeta, table, colorFieldColors, draggableEnabled, recordText]
  )
  return <KanbanFormatContext.Provider value={value}>{children}</KanbanFormatContext.Provider>
}
