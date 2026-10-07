/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Drag-to-resize on a timeline bar — the records, the write, and the wiring
 * the bars read (`timeline-resize.tsx` draws the handles).
 *
 * A handle sits at each end of a bar whose date its reader may write — the
 * server names those fields (`resizeFields`) from the table's update grant and
 * the field's write rule, so a reader without them is drawn no handle at all,
 * and a system-source timeline is never given any. A released handle commits
 * a whole number of days (`timeline-resize-compute.ts`) through ONE records-API
 * update, so the usual permission, field rules, automations and webhooks
 * apply. The bar repaints at the saved day at once; a refused write puts it
 * back.
 */

import { createContext, useCallback, useMemo, useState } from 'react'
import { resizedValue, type ResizeEdge } from './timeline-resize-compute'
import { useTimelineRecords } from './use-timeline-records'
import type { TimelineItem } from './timeline-compute'
import type { RecordsDataSource } from '../hooks/use-records-query'
import type { TableRecord } from '../runtime/types'

/** What a bar needs to draw its handles and commit a drop. */
export interface TimelineResize {
  /** The edges a handle is drawn on. */
  readonly edges: readonly ResizeEdge[]
  readonly commit: (item: TimelineItem, edge: ResizeEdge, days: number) => void
}

export const TimelineResizeContext = createContext<TimelineResize | undefined>(undefined)

type Overrides = Readonly<Record<string, Readonly<Record<string, string>>>>

/** One records-API update; `true` when it was saved. */
async function saveDates(
  table: string,
  id: string,
  patch: Readonly<Record<string, string>>
): Promise<boolean> {
  try {
    const res = await fetch(`/api/tables/${encodeURIComponent(table)}/records/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return res.ok
  } catch {
    return false
  }
}

/** `overrides` without the entry of `id`. */
const without = (overrides: Overrides, id: string): Overrides =>
  Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== id))

/** A record's two dates, as the resize arithmetic reads them. */
const datesOf = (record: TableRecord, startField?: string, endField?: string) => ({
  start: startField === undefined ? undefined : record[startField],
  end: endField === undefined ? undefined : record[endField],
})

/**
 * The records with every saved-or-saving resize applied, and the resize
 * wiring for the bars — `undefined` when the reader may move neither date.
 */
function useTimelineResize(args: {
  readonly records: readonly TableRecord[]
  readonly table: string | undefined
  readonly startField: string | undefined
  readonly endField: string | undefined
  readonly resizeFields: readonly string[] | undefined
}): {
  readonly records: readonly TableRecord[]
  readonly resize: TimelineResize | undefined
} {
  const { table, startField, endField, resizeFields } = args
  const [overrides, setOverrides] = useState<Overrides>({})
  const records = useMemo(
    () =>
      args.records.map((record) => {
        const override = overrides[String(record['id'])]
        return override === undefined ? record : { ...record, ...override }
      }),
    [args.records, overrides]
  )
  const commit = useCallback(
    (item: TimelineItem, edge: ResizeEdge, days: number) => {
      const field = edge === 'end' ? endField : startField
      const record = records.find((r) => String(r['id']) === item.id)
      if (table === undefined || field === undefined || record === undefined) return
      const value = resizedValue({ edge, days, ...datesOf(record, startField, endField) })
      if (value === undefined) return
      const patch = { ...overrides[item.id], [field]: value }
      setOverrides((current) => ({ ...current, [item.id]: patch }))
      void saveDates(table, item.id, { [field]: value }).then((saved) => {
        if (!saved) setOverrides((current) => without(current, item.id))
      })
    },
    [records, overrides, table, startField, endField]
  )
  const startMovable = startField !== undefined && (resizeFields ?? []).includes(startField)
  const endMovable = endField !== undefined && (resizeFields ?? []).includes(endField)
  const resize = useMemo((): TimelineResize | undefined => {
    const edges = [
      ...(startMovable ? ['start' as const] : []),
      ...(endMovable ? ['end' as const] : []),
    ]
    return edges.length === 0 || table === undefined ? undefined : { edges, commit }
  }, [startMovable, endMovable, table, commit])
  return { records, resize }
}

const NO_RECORDS: readonly TableRecord[] = []

/**
 * A timeline's records — fetched, with every saved-or-saving resize applied —
 * its query state, and the resize wiring its bars read.
 */
export function useTimelineData(
  dataSource: RecordsDataSource | undefined,
  fields: {
    readonly startField: string | undefined
    readonly endField: string | undefined
    readonly resizeFields: readonly string[] | undefined
  }
) {
  const query = useTimelineRecords(dataSource)
  const resized = useTimelineResize({
    records: query.data?.records ?? NO_RECORDS,
    table: dataSource?.table,
    ...fields,
  })
  return { ...query, ...resized }
}
