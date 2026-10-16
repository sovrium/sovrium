/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-drawer's DB-table record read: the GET per (table, id), the
 * form-ready string copy the editable controls bind to, and the inverse — the
 * value each field writes back. Split out of
 * `record-drawer-island.tsx` to keep that island inside its size cap.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { toEntryFormValues, type ValueEntry, type Values } from './record-drawer-values'

export type { Values } from './record-drawer-values'
export type RawRecord = Record<string, unknown>

export const EMPTY_RECORD: RawRecord = {}

/**
 * The records API's answer for one id: its RAW values (structured display needs
 * them), or `notFound` when it answers `404` — which it does alike for an id
 * that does not exist and for a row its reader may not read.
 */
type RecordRead = { readonly record: RawRecord; readonly notFound: boolean }

async function fetchRecord(table: string, recordId: string): Promise<RecordRead> {
  const res = await fetch(`/api/tables/${table}/records/${recordId}`)
  if (!res.ok) return { record: {}, notFound: res.status === 404 }
  const body = (await res.json()) as { readonly record?: RawRecord }
  return { record: body.record ?? (body as RawRecord), notFound: false }
}

/** The record cannot be shown: the drawer offers nothing to edit or save. */
const answeredNotFound = (
  enabled: boolean,
  query: { readonly isFetching: boolean; readonly data?: RecordRead | undefined }
): boolean => enabled && !query.isFetching && query.data?.notFound === true

/**
 * Read the DB-table record for the open drawer, and seed the editable copy.
 *
 * The record is read per (table, id) and re-read on EVERY open — the drawer is
 * an edit surface, so a copy cached from a previous open could be a value the
 * operator has since changed through the grid. `staleTime` is therefore left at
 * zero, and re-enabling the query on open is what re-issues the GET.
 *
 * The effect this replaced had no cancellation at all: a second open before the
 * first response landed could paint the earlier record over the later one.
 * Keying the read retires that race rather than guarding it — a response for a
 * key nothing is observing is never rendered.
 *
 * Seeding `values` stays an effect, and that is not a leftover. `values` is not
 * the server's state: it is the operator's draft, diverging from the response
 * the moment they type. The LOAD GATE is what makes the seeding safe — the body
 * accepts no input until `loading` clears, so this can never overwrite a
 * keystroke.
 *
 * The gate clears on the SEEDING, not on the response. The response lands one
 * commit before the effect copies it into `values`, and a gate keyed on the
 * fetch alone unlocked the inputs for that commit while they were still empty —
 * a keystroke in that window was then overwritten, or the reader saw a blank
 * field. `seeded` remembers which response was copied; until it is the one on
 * screen, the drawer stays locked.
 */
export function useTableRecordRead(read: {
  readonly open: boolean
  readonly table: string | undefined
  readonly recordId: string | undefined
  readonly setValues: Dispatch<SetStateAction<Values>>
  readonly entries: ReadonlyArray<ValueEntry>
}): { readonly record: RawRecord; readonly loading: boolean; readonly notFound: boolean } {
  const { open, table, recordId, setValues, entries } = read
  const enabled = open && Boolean(table) && Boolean(recordId)
  const recordQuery = useQuery({
    queryKey: ['record-drawer', 'table-record', table, recordId],
    queryFn: () => fetchRecord(table ?? '', recordId ?? ''),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const data = recordQuery.data?.record
  const [seeded, setSeeded] = useState<RawRecord | undefined>(undefined)
  useEffect(() => {
    if (data === undefined) return
    setValues(toEntryFormValues(data, entries))
    setSeeded(data)
    // The entries are fixed for the sheet's life; a new response is what reseeds.
  }, [data, setValues])

  return {
    record: data ?? EMPTY_RECORD,
    notFound: answeredNotFound(enabled, recordQuery),
    // True while the record GET is in flight, and until its response is in the
    // inputs — see the LOAD GATE note above for why the body is inert until then.
    loading: enabled && (recordQuery.isFetching || (data !== undefined && seeded !== data)),
  }
}
