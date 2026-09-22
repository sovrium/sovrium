/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { groupRecords, type KanbanColumnData } from './group-records'
import type { TableRecord } from '../runtime/types'

/** One lane of a two-axis board: its value, and the full column set inside it. */
export interface KanbanLaneData {
  readonly value: string
  readonly columns: readonly KanbanColumnData[]
  /** Every record in this lane, across all its columns — the lane's own count. */
  readonly recordCount: number
}

export interface BuildKanbanGridInput {
  readonly records: readonly TableRecord[]
  readonly columnField: string
  readonly columnOptions: readonly string[] | undefined
  readonly columnColors: Readonly<Record<string, string>> | undefined
  readonly laneField: string
  readonly laneOptions: readonly string[] | undefined
  /** Draw a declared lane that holds no records. Defaults to `true`. */
  readonly showEmptyLanes: boolean
}

/** The column values every lane draws, resolved ONCE from the whole record set. */
export interface KanbanGrid {
  readonly lanes: readonly KanbanLaneData[]
  readonly columnHeaders: readonly KanbanColumnData[]
}

/**
 * Split a board into the grid its two grouping axes describe.
 *
 * ─── WHY THIS CALLS `groupRecords` TWICE RATHER THAN BUCKETING ITSELF ──────
 *
 * The lane axis inherits the column axis' semantics wholesale — that is the
 * contract `KanbanSwimlanesSchema` states, and the one thing a second grouping
 * implementation would quietly break. Declared option order, an undeclared
 * value appended rather than dropped, and one `Uncategorized` bucket for a
 * null/empty field are all rules that live in exactly one function today. They
 * still do.
 *
 * ─── THE COLUMN SET IS RESOLVED ACROSS ALL RECORDS, NOT PER LANE ───────────
 *
 * Grouping each lane's own records would give each lane its own column list, so
 * an undeclared value present in one lane only would append a fourth column
 * there and nowhere else — and every column right of the gap would then sit at
 * a different x in that lane than in its neighbours. A board is read DOWN a
 * column as much as along a lane, so the column vocabulary is computed once
 * from the whole set and handed to every lane as its `columnOptions`. That also
 * makes the empty cell reachable, which is what surfaces `emptyColumnMessage`
 * one level deeper than a single-axis board needs it.
 */
export function buildKanbanGrid(input: BuildKanbanGridInput): KanbanGrid {
  const { records, columnField, columnOptions, columnColors, laneField } = input

  // The whole-board column set, in the order the single-axis board would draw
  // it. Doubles as the shared header row, so its counts are board-wide totals.
  const columnHeaders = groupRecords(records, columnField, columnOptions, columnColors)
  const columnValues = columnHeaders.map((column) => column.value)

  const allLanes = groupRecords(records, laneField, input.laneOptions)
  const lanes = input.showEmptyLanes ? allLanes : allLanes.filter((lane) => lane.records.length > 0)

  return {
    columnHeaders,
    lanes: lanes.map((lane) => ({
      value: lane.value,
      recordCount: lane.records.length,
      columns: groupRecords(lane.records, columnField, columnValues, columnColors),
    })),
  }
}
