/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CalendarWeekday } from '@/domain/kernel/format/calendar-date'
import type { App } from '@/domain/models/app'

type TableLike = Pick<NonNullable<App['tables']>[number], 'fields'>

/**
 * The `date` and `datetime` fields of a table that declare a `weekday`, by
 * name — what a client-fetching list or gallery needs to print such a date the
 * way the grid prints it, "Sunday 20 September 2026" rather than the stored
 * ISO text. The island only ever sees records, so the fact about the FIELD is
 * answered here and serialised with its props. `undefined` when no field
 * declares one, so nothing is serialised.
 */
export function resolveWeekdayFields(
  table: TableLike | undefined
): Readonly<Record<string, CalendarWeekday>> | undefined {
  const entries = (table?.fields ?? []).flatMap((field) => {
    const { weekday } = field as { readonly weekday?: unknown }
    return (field.type === 'date' || field.type === 'datetime') &&
      (weekday === 'short' || weekday === 'long')
      ? [[field.name, weekday] as const]
      : []
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}
