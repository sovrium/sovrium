/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record-drawer's DB-table record read: the GET per (table, id) and the
 * form-ready string copy the editable controls bind to. Split out of
 * `record-drawer-island.tsx` to keep that island inside its size cap.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, type Dispatch, type SetStateAction } from 'react'

export type Values = Record<string, string>
export type RawRecord = Record<string, unknown>

export const EMPTY_RECORD: RawRecord = {}

/** Coerce a record value to its form-ready string form. */
export function toFormValue(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/** Project a raw record into the form-ready string map the text inputs bind to. */
function toFormValues(record: RawRecord): Values {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toFormValue(value)]))
}

/** Fetch the record by id; returns its RAW values (structured display needs them). */
async function fetchRecord(table: string, recordId: string): Promise<RawRecord> {
  const res = await fetch(`/api/tables/${table}/records/${recordId}`)
  if (!res.ok) return {}
  const body = (await res.json()) as { readonly record?: RawRecord }
  return body.record ?? (body as RawRecord)
}

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
 */
export function useTableRecordRead(
  open: boolean,
  table: string | undefined,
  recordId: string | undefined,
  setValues: Dispatch<SetStateAction<Values>>
): { readonly record: RawRecord; readonly loading: boolean } {
  const enabled = open && Boolean(table) && Boolean(recordId)
  const recordQuery = useQuery({
    queryKey: ['record-drawer', 'table-record', table, recordId],
    queryFn: () => fetchRecord(table ?? '', recordId ?? ''),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const { data } = recordQuery
  useEffect(() => {
    if (data !== undefined) setValues(toFormValues(data))
  }, [data, setValues])

  return {
    record: data ?? EMPTY_RECORD,
    // True while the record GET is in flight — see the LOAD GATE note in the
    // module docblock for why the body is inert until it resolves.
    loading: enabled && recordQuery.isFetching,
  }
}
