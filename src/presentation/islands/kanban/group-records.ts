/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TableRecord } from '../runtime/types'

export interface KanbanColumnData {
  readonly value: string
  readonly records: readonly TableRecord[]
  /**
   * Hex accent color for the column header, resolved from a colored `status`
   * groupBy option (`{ value, color }`). Absent for plain-string options.
   */
  readonly color?: string
  /** The option's label in the page language, when it reads differently from `value`. */
  readonly label?: string
}

/** What a column header reads beside its value, both keyed by the stored value. */
export interface KanbanHeaderPaint {
  readonly colors?: Readonly<Record<string, string>>
  readonly labels?: Readonly<Record<string, string>>
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
 *
 * With `paint.colors` (a colored `status` groupBy), each column carries its
 * option `color` so the header can render an accent swatch; with
 * `paint.labels`, its option `label`, which the header prints instead of the value.
 */
export function groupRecords(
  records: readonly TableRecord[],
  field: string,
  columnOptions: readonly string[] | undefined,
  paint?: KanbanHeaderPaint
): readonly KanbanColumnData[] {
  // The header's accent and label: both keyed by the stored value, never by the label.
  const decorate = (value: string) => ({
    ...(paint?.colors?.[value] ? { color: paint.colors[value] } : {}),
    ...(paint?.labels?.[value] ? { label: paint.labels[value] } : {}),
  })

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
      ...decorate(value),
    }))
    const undeclared = Array.from(buckets.entries())
      .filter(([value]) => !columnOptions.includes(value))
      .map(([value, columnRecords]) => ({ value, records: columnRecords }))
    return [...declared, ...undeclared]
  }

  return Array.from(buckets.entries()).map(([value, columnRecords]) => ({
    value,
    records: columnRecords,
    ...decorate(value),
  }))
}
