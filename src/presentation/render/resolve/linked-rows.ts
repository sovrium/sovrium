/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The linked rows a `repeat` over a to-many field of a bound record iterates.
 *
 * A many-to-many or one-to-many field of a bound record holds the IDS of the
 * records it links, as the records API answers it: `$record.pets` prints them
 * and `filter: [{ field: id, operator: in, value: $record.pets }]` reads them.
 * A `repeat: { record: pets, as: p }` needs more than ids: each copy reads
 * `$p.name`. So, for the fields a page's `repeat` names, the bound record also
 * carries the linked rows themselves — read as the visitor, less the columns
 * she may not read — under {@link LINKED_ROWS_KEY}, and a repeat iterates them
 * in place of the ids ({@link withLinkedRows}).
 */

import { componentEntryLists } from './component-slot-walk'
import type { Component } from '@/domain/models/app/pages/components'

type Fields = Readonly<Record<string, unknown>>

/** The key a bound record carries its repeated fields' linked rows under. */
export const LINKED_ROWS_KEY = '_linked'

const isFields = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * `record` with each field it carries linked rows for holding those rows
 * instead of their ids — the record a `repeat` iterates. Unchanged when it
 * carries none.
 */
export function withLinkedRows(record: Fields): Fields {
  const linked = record[LINKED_ROWS_KEY]
  return isFields(linked) ? { ...record, ...linked } : record
}

/** A component node: an object naming its `type` (a `$ref` or a string child is not one). */
const isComponentNode = (entry: unknown): entry is Component & Fields =>
  isFields(entry) && typeof entry['type'] === 'string'

/** The `repeat.record` one node declares, if any. */
function repeatedFieldOf(node: Fields): readonly string[] {
  const { repeat } = node
  if (!isFields(repeat)) return []
  return typeof repeat['record'] === 'string' ? [repeat['record']] : []
}

/**
 * The field names every `repeat` in `components` iterates, at any depth. A
 * name that is no to-many field of the bound table reads nothing more.
 */
export function repeatedFieldNames(
  components: readonly unknown[] | undefined
): ReadonlySet<string> {
  const walk = (entries: readonly unknown[]): readonly string[] =>
    entries.flatMap((entry) =>
      isComponentNode(entry)
        ? [...repeatedFieldOf(entry), ...componentEntryLists(entry).flatMap((list) => walk(list))]
        : []
    )
  return new Set(walk(components ?? []))
}
