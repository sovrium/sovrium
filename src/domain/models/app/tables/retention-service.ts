/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { zonedIsoDate, zonedStartOfDayDaysBefore } from '@/domain/kernel/time/zoned-calendar'
import { DEFAULT_RETENTION_FIELD } from './retention-validation'

/**
 * What the daily retention sweep needs to know about the tables it bounds,
 * and where each window starts. Pure: the instant and the zone are handed in.
 */

/** One table the sweep bounds: the column a row's age is read from, and how. */
export interface TableRetentionPlan {
  readonly tableName: string
  readonly column: string
  /** `day` compares a `date` column on the calendar day, `instant` a timestamp. */
  readonly compare: 'day' | 'instant'
  readonly days: number
}

/** Shape of a table relevant to its retention plan. */
interface TableWithRetention {
  readonly name: string
  readonly fields: ReadonlyArray<{ readonly name: string; readonly type: string }>
  readonly retention?: { readonly field?: string; readonly days: number }
}

/**
 * The tables of an app that declare a retention window, with the column each
 * counts from (`created_at` when it names none). A `date` field is compared on
 * the day; every other accepted kind is a timestamp.
 */
export const tableRetentionPlans = (
  tables: ReadonlyArray<TableWithRetention> | undefined
): readonly TableRetentionPlan[] =>
  (tables ?? []).flatMap((table) => {
    const { retention } = table
    if (retention === undefined) return []
    const column = retention.field ?? DEFAULT_RETENTION_FIELD
    const declared = table.fields.find((field) => field.name === column)
    return [
      {
        tableName: table.name,
        column,
        compare: declared?.type === 'date' ? 'day' : 'instant',
        days: retention.days,
      } as const,
    ]
  })

/** Where a window starts: the instant, and the calendar day it falls on. */
export interface RetentionCutoff {
  /** Midnight, in the operator timezone, `days` calendar days before today. */
  readonly instant: Date
  /** That day as `YYYY-MM-DD`: a `date` value before it is past the window. */
  readonly day: string
}

/**
 * The start of a `days`-day window — the activity-log rule with `days` in
 * place of one year: a row is past the window once its field falls before
 * midnight, operator timezone, of the day `days` days before today.
 *
 * @param now - the reference instant.
 * @param timeZone - the operator timezone (an IANA zone identifier).
 * @param days - the window, in calendar days.
 */
export const retentionCutoff = (
  now: Readonly<Date>,
  timeZone: string,
  days: number
): RetentionCutoff => {
  const instant = zonedStartOfDayDaysBefore(now, timeZone, days)
  return { instant, day: zonedIsoDate(instant, timeZone) }
}
