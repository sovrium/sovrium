/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A calendar's `colorField` names ONE option: an event takes one colour, from
 * the option its record holds. A `multi-select` holds several, and would be
 * painted as the joined value ("YouTube,Blog") from the hashed palette with no
 * word — so it is refused wherever a config is read, naming the field.
 *
 * Existence of the field is the field-reference sweep's verdict
 * (`component-field-references.ts`), and an unresolvable table the table
 * rule's; neither is repeated here. Pure: no I/O, no schema import.
 */

import { collectComponentsOfType } from '@/domain/models/app/pages/components/component-field-references'

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The declared type of `field` on `table`, or `undefined` when either is unknown. */
function fieldType(config: unknown, table: string, field: string): unknown {
  const tables = isRecord(config) && Array.isArray(config['tables']) ? config['tables'] : []
  const declared = tables.find(
    (entry: unknown): entry is RawRecord => isRecord(entry) && entry['name'] === table
  )
  const fields = Array.isArray(declared?.['fields']) ? declared['fields'] : []
  const column = fields.find(
    (entry: unknown): entry is RawRecord => isRecord(entry) && entry['name'] === field
  )
  return column?.['type']
}

/**
 * Refuse a calendar whose `colorField` names a multi-select.
 *
 * @returns one message per offending calendar, empty otherwise
 */
export function validateCalendarColorFields(config: unknown): readonly string[] {
  return collectComponentsOfType(config, 'calendar').flatMap((calendar) => {
    const { colorField: field, dataSource: source } = calendar
    const { table } = isRecord(source) ? source : {}
    if (typeof field !== 'string' || typeof table !== 'string') return []
    return fieldType(config, table, field) === 'multi-select'
      ? [
          `Calendar colorField '${field}' names a multi-select on table '${table}': an event takes one colour, from one option. Name a single-select field.`,
        ]
      : []
  })
}
