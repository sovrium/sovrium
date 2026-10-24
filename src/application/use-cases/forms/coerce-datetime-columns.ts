/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Store every date-and-time answer a form binds as the instant it names.
 *
 * A browser's date-and-time control posts a wall-clock reading such as
 * `2026-11-04T10:00`, with no zone. The hosted form draws a `datetime` column's
 * value as its reading in the column's `timeZone` (the app's when it names
 * none), so the reading is turned back into an instant on that same clock
 * here — at the offset in force on that day — and an answer submitted
 * untouched stores the instant it started from. An answer that already
 * carries its offset passes through, as does every other column — and so does
 * a reading on a column whose `timeZone` is `local` (only the visitor's
 * browser knows that zone) or that names no real minute: the record write
 * judges those as it always has.
 */

import { zonedWallClockInstant } from '@/domain/kernel/time/zoned-calendar'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * The zone of each `datetime` column of `submitTo.table` the form binds with a
 * `table-field`, keyed by column. Empty when the form writes no table.
 */
export const boundDatetimeZones = (
  app: Readonly<App>,
  form: Readonly<Form>
): ReadonlyMap<string, string> => {
  const table = app.tables?.find((candidate) => candidate.name === form.submitTo.table)
  if (table === undefined) return new Map()
  const zones = new Map(
    (table.fields ?? [])
      .filter((field) => field.type === 'datetime')
      .map((field) => {
        const declared = (field as { readonly timeZone?: unknown }).timeZone
        return [field.name, typeof declared === 'string' ? declared : undefined] as const
      })
  )
  if (zones.size === 0) return new Map()
  const appZone = parseSovriumTimezone().zoneId
  return new Map(
    form.fields.flatMap((field) =>
      field.kind === 'table-field' && zones.has(field.column)
        ? [[field.column, zones.get(field.column) ?? appZone] as const]
        : []
    )
  )
}

/**
 * The body with each named `datetime` answer that is a wall-clock reading
 * replaced by the ISO instant it names in its column's zone. Every other entry
 * passes through untouched.
 */
export const coerceDatetimeAnswers = (
  body: Readonly<Record<string, unknown>>,
  zones: ReadonlyMap<string, string>
): Readonly<Record<string, unknown>> => {
  if (zones.size === 0) return { ...body }
  return Object.fromEntries(
    Object.entries(body).map(([key, value]) => {
      const zone = zones.get(key)
      if (zone === undefined || typeof value !== 'string') return [key, value]
      return [key, zonedWallClockInstant(value, zone)?.toISOString() ?? value]
    })
  )
}
