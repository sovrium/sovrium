/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A list's or a gallery's records drawn under the groups of the view they are
 * bound to (`groupBy`), in the grid's vocabulary: each header carries
 * `data-group-header`, its value on `data-group` (`''` for the records the
 * field leaves empty) and a `[data-group-count]`, and is the control that
 * opens and closes its group (`aria-expanded`). Groups follow the view's
 * `direction`, the empty one always last; inside a group the records keep the
 * order the view read them in. A view whose `groupBy` is `collapsed` starts
 * every group closed.
 *
 * Fetched only by a component bound to a grouped view, so an ungrouped list or
 * gallery pays nothing for it.
 */

import { useState, type ReactElement, type ReactNode } from 'react'
import type { TableRecord } from '../runtime/types'

/** The first level of a view's `groupBy`, as the server read it. */
export interface RecordGroupBy {
  readonly field: string
  readonly direction?: 'asc' | 'desc'
  readonly collapsed?: boolean
}

interface RecordGroup {
  readonly value: string
  readonly records: readonly TableRecord[]
}

/** The group a record falls into: its field's text, `''` when empty. */
const groupValueOf = (record: TableRecord, field: string): string => {
  const raw = record[field]
  return raw === null || raw === undefined ? '' : String(raw)
}

/** The records bucketed by value, groups in the view's order, the empty one last. */
function groupRecords(
  records: readonly TableRecord[],
  groupBy: RecordGroupBy
): readonly RecordGroup[] {
  const buckets = records.reduce<ReadonlyMap<string, readonly TableRecord[]>>((map, record) => {
    const value = groupValueOf(record, groupBy.field)
    return new Map([...map, [value, [...(map.get(value) ?? []), record]]])
  }, new Map())
  const { compare } = new Intl.Collator(undefined, { numeric: true })
  const values = [...buckets.keys()].filter((value) => value !== '').toSorted(compare)
  const ordered = groupBy.direction === 'desc' ? values.toReversed() : values
  return [...ordered, ...(buckets.has('') ? [''] : [])].map((value) => ({
    value,
    records: buckets.get(value) ?? [],
  }))
}

/** One group: its header, the control opening and closing it, then its records. */
function Group({
  group,
  startsOpen,
  emptyLabel,
  renderRecords,
}: {
  readonly group: RecordGroup
  readonly startsOpen: boolean
  readonly emptyLabel: string
  readonly renderRecords: (records: readonly TableRecord[], value: string) => ReactNode
}): ReactElement {
  const [open, setOpen] = useState(startsOpen)
  return (
    <section data-slot="record-group">
      <button
        type="button"
        data-group-header=""
        data-group={group.value}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="text-foreground flex w-full items-center gap-2 py-2 text-left text-sm font-medium"
      >
        <span aria-hidden="true">{open ? '▼' : '▶'}</span>
        <span>{group.value === '' ? emptyLabel : group.value}</span>
        <span
          data-group-count=""
          className="text-muted-foreground"
        >
          {group.records.length}
        </span>
      </button>
      {open ? renderRecords(group.records, group.value) : undefined}
    </section>
  )
}

/** The records under a header per group of the bound view. */
export default function GroupedRecords({
  records,
  groupBy,
  emptyLabel,
  renderRecords,
}: {
  readonly records: readonly TableRecord[]
  readonly groupBy: RecordGroupBy
  /** The heading of the records the grouping field leaves empty, in the page language. */
  readonly emptyLabel: string
  /** A group's records, drawn by the component; its element carries `data-group`. */
  readonly renderRecords: (records: readonly TableRecord[], value: string) => ReactNode
}): ReactElement {
  return (
    <div data-slot="record-groups">
      {groupRecords(records, groupBy).map((group) => (
        <Group
          key={group.value}
          group={group}
          startsOpen={groupBy.collapsed !== true}
          emptyLabel={emptyLabel}
          renderRecords={renderRecords}
        />
      ))}
    </div>
  )
}
