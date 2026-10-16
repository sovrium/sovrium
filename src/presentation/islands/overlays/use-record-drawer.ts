/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  withRecordTextFields,
  type RecordTextFields,
} from '@/domain/models/app/tables/record-text-service'
import { resolvePageLocale } from '@/presentation/islands/runtime/page-locale'
import { useRecordQuery } from '../hooks/use-record-query'
import { clearDrawerAddress, NEW_RECORD_ADDRESS, writeDrawerAddress } from './record-drawer-address'
import {
  EMPTY_RECORD,
  useTableRecordRead,
  type RawRecord,
  type Values,
} from './record-drawer-record-read'
import { useCreateTrigger } from './use-record-drawer-create'
import { useDeepLinkOpen, useOpenDrawerEvent } from './use-record-drawer-open'
import type { ValueEntry } from './record-drawer-values'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'

/**
 * The record drawer's state: which record it is open on, the record it
 * loaded, and the open, close and save handlers its body is wired to.
 */

/** An entry a new record starts from: its name and the default it declares. */
export type DrawerEntry = ValueEntry & { readonly defaultValue?: string }

/** The values a new record starts with: each entry's declared default. */
const defaultValues = (entries: ReadonlyArray<DrawerEntry>): Values =>
  Object.fromEntries(
    entries.flatMap((entry) =>
      entry.defaultValue === undefined ? [] : [[entry.name, entry.defaultValue] as const]
    )
  )

/** What the drawer is: its id, its binding, whether a bare address opens it, its entries. */
export interface RecordDrawerBinding {
  readonly id: string | undefined
  readonly table: string | undefined
  readonly system: SystemDetailSource | undefined
  readonly deepLink: boolean
  readonly entries: ReadonlyArray<DrawerEntry>
}

/** The drawer's open lifecycle + DB-table record fetch, keyed to the dispatched id. */
export function useRecordDrawer(binding: RecordDrawerBinding) {
  const { id, table, system, entries } = binding
  const [open, setOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | undefined>()
  const [creating, setCreating] = useState(false)
  const [values, setValues] = useState<Values>({})
  const openRef = useRef(false)
  openRef.current = open

  // A record id, or — opened with no record — a new one starting from the
  // declared defaults. Only a table-bound sheet creates: a system detail has
  // nothing to post to.
  const openOn = useCallback(
    (target: string) => {
      const create = target === NEW_RECORD_ADDRESS
      if (create && !table) return
      setRecordId(create ? undefined : target)
      setCreating(create)
      if (create) setValues(defaultValues(entries))
      setOpen(true)
      if (create && id) writeDrawerAddress(id, NEW_RECORD_ADDRESS)
    },
    [id, table, entries]
  )
  const startCreate = useCallback(() => openOn(NEW_RECORD_ADDRESS), [openOn])
  useOpenDrawerEvent(id, { table: Boolean(table), system: Boolean(system) }, openOn)
  useCreateTrigger(id, table, startCreate)
  useDeepLinkOpen(
    { id, bound: Boolean(table || system), deepLink: binding.deepLink },
    openRef,
    openOn
  )

  const read = useTableRecordRead({ open: open && !creating, table, recordId, setValues, entries })
  const close = useCallback(
    (next: boolean) => {
      setOpen(next)
      if (!next) setCreating(false)
      if (!next && id) clearDrawerAddress(id)
    },
    [id]
  )

  return {
    open,
    setOpen: close,
    recordId,
    creating,
    record: read.record,
    values,
    setValues,
    loading: read.loading,
    notFound: read.notFound,
  }
}

/**
 * Resolve the drawer's effective record: the DB-table fetch (`tableRecord`) OR,
 * for a system DETAIL binding, the SINGLE record from the shared single-record
 * detail query (the same hook the record-field / page-record islands use). The
 * detail query is disabled (a no-op) for a DB-table binding. The resolved record
 * feeds the ONE shared body — so CAP-3 structured fields, CAP-1 footer `$record.*`
 * actions, and read-only display all read the SAME record regardless of binding.
 *
 * With `recordText` (how each formatted field of the table reads, resolved by the
 * server) the record carries its formatted text in the page's language, which the
 * slot and a confirm prompt print — the text a record page prints for the same
 * value. Every address site keeps reading the stored value.
 */
export function useDrawerRecord(
  system: SystemDetailSource | undefined,
  recordId: string | undefined,
  tableRecord: RawRecord,
  recordText?: RecordTextFields
): RawRecord {
  const systemQuery = useRecordQuery('record-drawer', system ? { system } : undefined, recordId)
  const record = system ? (systemQuery.data ?? EMPTY_RECORD) : tableRecord
  return useMemo(
    () => withRecordTextFields(record, recordText, resolvePageLocale()) as RawRecord,
    [record, recordText]
  )
}

/**
 * The inline error and the per-field ones, plus the field-edit + close handlers
 * (an edit clears the banner and that field's own message).
 */
export function useDrawerHandlers(
  setValues: Dispatch<SetStateAction<Values>>,
  setOpen: (open: boolean) => void
): {
  readonly error: string | undefined
  readonly setError: (error: string | undefined) => void
  readonly fieldErrors: Readonly<Record<string, string>>
  readonly setFieldErrors: (errors: Readonly<Record<string, string>>) => void
  readonly onChange: (name: string, value: string) => void
  readonly onClose: () => void
} {
  const [error, setError] = useState<string | undefined>()
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({})
  const onChange = useCallback(
    (name: string, value: string) => {
      setError(undefined)
      setFieldErrors((prev) => {
        if (prev[name] === undefined) return prev
        const { [name]: _cleared, ...rest } = prev
        return rest
      })
      setValues((prev) => ({ ...prev, [name]: value }))
    },
    [setValues, setError]
  )
  const onClose = useCallback(() => {
    setError(undefined)
    setFieldErrors({})
    setOpen(false)
  }, [setOpen])
  return { error, setError, fieldErrors, setFieldErrors, onChange, onClose }
}
