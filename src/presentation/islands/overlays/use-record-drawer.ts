/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { subscribe } from '@/presentation/islands/runtime/event-bus'
import { useRecordQuery } from '../hooks/use-record-query'
import { addressedRecordId, clearDrawerAddress, writeDrawerAddress } from './record-drawer-address'
import {
  EMPTY_RECORD,
  toFormValue,
  useTableRecordRead,
  type RawRecord,
  type Values,
} from './record-drawer-record-read'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

/**
 * The record drawer's state: which record it is open on, the record it
 * loaded, and the open, close and save handlers its body is wired to.
 */

/** The drawer's open lifecycle + DB-table record fetch, keyed to the dispatched id. */
export function useRecordDrawer(
  id: string | undefined,
  table: string | undefined,
  system: SystemDetailSource | undefined,
  deepLink: boolean
) {
  const [open, setOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | undefined>()
  const [values, setValues] = useState<Values>({})

  useEffect(() => {
    if (!id) return undefined
    return subscribe('sovrium:open-drawer', (detail) => {
      if (detail.id !== id) return
      const opened = toFormValue(detail.record['id']) || undefined
      setRecordId(opened)
      setOpen(true)
      // Whatever opened it — a row, a card, an event, another drawer's footer —
      // the address now names this drawer and this record.
      if (opened !== undefined && (table || system)) writeDrawerAddress(id, opened)
    })
  }, [id, table, system])

  // `?record={id}` deep-link self-open: when
  // the surface is reached with a `?record=` param AND this drawer is record-bound
  // (a DB-table OR a system DETAIL endpoint), open itself for that record. Reading
  // the URL HERE — on the drawer's own mount — is race-free with respect to a
  // sibling island dispatching `sovrium:open-drawer` (cross-root `useEffect`
  // ordering is not guaranteed after an SPA content swap). The read is RETRIED
  // on a short schedule because the SPA nav module mounts this island BEFORE it
  // calls `history.pushState(url)`, so the very first read can still see the
  // pre-navigation URL; re-reading over ~400ms catches the pushState'd `?record=`.
  // A generic page that uses the drawer without `?record=` is unaffected.
  useEffect(() => {
    if ((!table && !system) || typeof window === 'undefined') return undefined
    const tryOpen = (): boolean => {
      // `?drawer=` names the drawer; a bare `?record=` opens only the first
      // record-bound drawer the page declares (see `record-drawer-address.ts`).
      const deepLinkId = addressedRecordId(id, deepLink)
      if (!deepLinkId) return false
      setRecordId(deepLinkId)
      setOpen(true)
      return true
    }
    if (tryOpen()) return undefined
    const timers = [0, 100, 250, 450].map((delay) => setTimeout(tryOpen, delay))
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [id, table, system, deepLink])

  const { record, loading, notFound } = useTableRecordRead(open, table, recordId, setValues)
  const close = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next && id) clearDrawerAddress(id)
    },
    [id]
  )

  return { open, setOpen: close, recordId, record, values, setValues, loading, notFound }
}

/**
 * Resolve the drawer's effective record: the DB-table fetch (`tableRecord`) OR,
 * for a system DETAIL binding, the SINGLE record from the shared single-record
 * detail query (the same hook the record-field / page-record islands use). The
 * detail query is disabled (a no-op) for a DB-table binding. The resolved record
 * feeds the ONE shared body — so CAP-3 structured fields, CAP-1 footer `$record.*`
 * actions, and read-only display all read the SAME record regardless of binding.
 */
export function useDrawerRecord(
  system: SystemDetailSource | undefined,
  recordId: string | undefined,
  tableRecord: RawRecord
): RawRecord {
  const systemQuery = useRecordQuery('record-drawer', system ? { system } : undefined, recordId)
  return system ? (systemQuery.data ?? EMPTY_RECORD) : tableRecord
}

/** The inline error, plus the field-edit + close handlers (a field edit clears the error). */
export function useDrawerHandlers(
  setValues: Dispatch<SetStateAction<Values>>,
  setOpen: (open: boolean) => void
): {
  readonly error: string | undefined
  readonly setError: (error: string | undefined) => void
  readonly onChange: (name: string, value: string) => void
  readonly onClose: () => void
} {
  const [error, setError] = useState<string | undefined>()
  const onChange = useCallback(
    (name: string, value: string) => {
      setError(undefined)
      setValues((prev) => ({ ...prev, [name]: value }))
    },
    [setValues, setError]
  )
  const onClose = useCallback(() => setOpen(false), [setOpen])
  return { error, setError, onChange, onClose }
}
