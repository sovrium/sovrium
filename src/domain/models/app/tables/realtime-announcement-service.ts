/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How one write's committed row changes are announced on the tables' change
 * streams.
 *
 * A write may change rows of several tables — a delete that cascades to its
 * children, an automation step that touches two tables — so its changes are
 * grouped by table first. Each table is then announced one of two ways:
 *
 *  - **row by row**, one `change` event per row, when the write changed at most
 *    `maxPerWrite` rows of it;
 *  - **as one `resync` notice** past that, carrying every changed row (as it
 *    stood before and after) so each subscriber can be judged on them in
 *    memory — the rows are stripped before anything reaches the wire.
 *
 * The threshold is per table and per write: a thousand-row import is one frame
 * per subscriber, and a ten-row batch that also cascades to three hundred child
 * rows is ten events on the parent table and one notice on the child table.
 */

type Row = Readonly<Record<string, unknown>>

/** One committed row change, as a stream announces it. Rows are flattened `{ id, ...fields }`. */
export interface AnnouncedRowChange {
  readonly tableName: string
  readonly event: 'insert' | 'update' | 'delete'
  readonly recordId: string
  /** The row as written — present for an insert and an update. */
  readonly record?: Row | undefined
  /** The row as it stood — present for an update and a delete. */
  readonly oldRecord?: Row | undefined
}

/** What one table's stream receives for one write. */
export type TableAnnouncement =
  | {
      readonly kind: 'rows'
      readonly tableName: string
      readonly changes: readonly AnnouncedRowChange[]
    }
  | {
      readonly kind: 'resync'
      readonly tableName: string
      /** Every changed row, before and after, for the subscribers' rules to be judged on. */
      readonly rows: readonly Row[]
    }

/** The rows one change carries for judging: the row as it stood and as written. */
const rowsOf = (change: AnnouncedRowChange): readonly Row[] =>
  [change.oldRecord, change.record].filter((row): row is Row => row !== undefined)

/** The changes grouped by table, tables in the order the write first touched them. */
const groupByTable = (
  changes: readonly AnnouncedRowChange[]
): ReadonlyMap<string, readonly AnnouncedRowChange[]> =>
  changes.reduce(
    (groups, change) =>
      new Map([...groups, [change.tableName, [...(groups.get(change.tableName) ?? []), change]]]),
    new Map<string, readonly AnnouncedRowChange[]>()
  )

/**
 * Plan the announcements of one write's changes: per table, the row events, or
 * a single resync when the write changed more than `maxPerWrite` of its rows.
 */
export const planAnnouncements = (
  changes: readonly AnnouncedRowChange[],
  maxPerWrite: number
): readonly TableAnnouncement[] =>
  [...groupByTable(changes)].map(([tableName, tableChanges]) =>
    tableChanges.length > maxPerWrite
      ? { kind: 'resync', tableName, rows: tableChanges.flatMap(rowsOf) }
      : { kind: 'rows', tableName, changes: tableChanges }
  )
