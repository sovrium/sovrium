/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../shared/types'

export interface KanbanColumnData {
  readonly value: string
  readonly records: readonly TableRecord[]
}

/**
 * Groups records into columns by the configured field.
 *
 * Column ordering rules:
 *   1. When `columnOptions` is provided (e.g. select/status field options),
 *      render one column per option in the schema-defined order. This keeps
 *      empty columns visible so the empty-column message can render.
 *   2. Otherwise, infer columns from distinct values present in the data,
 *      preserving first-seen order.
 *
 * Records whose grouping field is null/undefined/empty are bucketed under
 * 'Uncategorized' so they stay visible on the board.
 */
export function groupRecords(
  records: readonly TableRecord[],
  field: string,
  columnOptions: readonly string[] | undefined
): readonly KanbanColumnData[] {
  // Build a value -> records map preserving insertion order
  const buckets = records.reduce<ReadonlyMap<string, readonly TableRecord[]>>((acc, record) => {
    const raw = record[field]
    const value = raw === null || raw === undefined || raw === '' ? 'Uncategorized' : String(raw)
    const existing = acc.get(value) ?? []
    return new Map([...acc, [value, [...existing, record]]])
  }, new Map())

  if (columnOptions && columnOptions.length > 0) {
    // Schema-driven columns: one per option, ordered by option list.
    // Any value present in the data but not declared in the options list is
    // appended at the end so records aren't silently dropped.
    const declared = columnOptions.map((value) => ({
      value,
      records: buckets.get(value) ?? [],
    }))
    const undeclared = Array.from(buckets.entries())
      .filter(([value]) => !columnOptions.includes(value))
      .map(([value, columnRecords]) => ({ value, records: columnRecords }))
    return [...declared, ...undeclared]
  }

  return Array.from(buckets.entries()).map(([value, columnRecords]) => ({
    value,
    records: columnRecords,
  }))
}
