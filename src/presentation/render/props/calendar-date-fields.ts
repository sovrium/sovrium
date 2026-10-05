/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The fields of a calendar's table that hold a CALENDAR DAY rather than an
 * instant: a `date` field that does not also record a time.
 *
 * The calendar island receives records, never the field schema, and a day
 * reaches it as a midnight timestamp on PostgreSQL — indistinguishable from a
 * `datetime` at midnight. So the server names those fields, and the island
 * draws a range on them as whole days whose end is the LAST day included
 *, where a `datetime` end stays the instant it names.
 */

import { readableFieldSetOf } from './caller-table-inputs'
import type { Component } from '@/domain/models/app/pages/components'
import type { Tables } from '@/domain/models/app/tables'

/** The names of `table`'s day-valued fields. */
function resolveDateOnlyFields(table: Tables[number]): readonly string[] {
  return table.fields
    .filter((field) => {
      const declared = field as { readonly type: string; readonly includeTime?: boolean }
      return declared.type === 'date' && declared.includeTime !== true
    })
    .map((field) => field.name)
}

/**
 * `field → zone` for the fields of `table` that declare their own `timeZone`.
 *
 * A date-time reads in the zone its field declares, else in the operator zone
 * the page carries; the calendar island, which never sees the field schema,
 * needs the declared ones named. Absent when no field declares one.
 */
function resolveFieldTimeZones(
  table: Tables[number]
): Readonly<Record<string, string>> | undefined {
  const entries = table.fields.flatMap((field) => {
    const { timeZone } = field as { readonly timeZone?: unknown }
    return typeof timeZone === 'string' && timeZone !== '' ? [[field.name, timeZone] as const] : []
  })
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}

/**
 * A calendar's day-valued fields, and the fields declaring their own zone when
 * any does — among the fields the reader `component` was stamped for may read
 * (`readableFieldSetOf`; every field without a stamp): a field she may not
 * read is named in neither.
 */
export function resolveCalendarDateInputs(
  declared: Tables[number],
  component: Component
): {
  readonly dateOnlyFields: readonly string[]
  readonly fieldTimeZones?: Readonly<Record<string, string>>
} {
  const readable = readableFieldSetOf(declared, component)
  const table =
    readable === undefined
      ? declared
      : { ...declared, fields: declared.fields.filter((field) => readable.has(field.name)) }
  const fieldTimeZones = resolveFieldTimeZones(table)
  return {
    dateOnlyFields: resolveDateOnlyFields(table),
    ...(fieldTimeZones === undefined ? {} : { fieldTimeZones }),
  }
}
