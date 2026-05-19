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

export function groupRecords(
  records: readonly TableRecord[],
  field: string,
  columnOptions: readonly string[] | undefined
): readonly KanbanColumnData[] {
  const buckets = records.reduce<ReadonlyMap<string, readonly TableRecord[]>>((acc, record) => {
    const raw = record[field]
    const value = raw === null || raw === undefined || raw === '' ? 'Uncategorized' : String(raw)
    const existing = acc.get(value) ?? []
    return new Map([...acc, [value, [...existing, record]]])
  }, new Map())

  if (columnOptions && columnOptions.length > 0) {
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
