/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record drawer's Save: check, then PATCH what its reader may write.
 *
 * What is sent is what the reader may write and nothing else: a structured
 * `renderAs` block and a field stamped `readOnly` (one their role may not
 * write) never leave the drawer, so a save is never refused for a value the
 * reader did not touch. The client check stops only a REQUIRED field the reader
 * may write that was left blank — an optional field left empty saves — and it
 * says so in the page language the SSR host resolved.
 */

import { useCallback } from 'react'
import { dispatch } from '@/presentation/islands/runtime/event-bus'
import { isStructured, type RecordDrawerField } from './record-drawer-field'
import { toWireValue, type Values } from './record-drawer-record-read'

export interface SaveParams {
  readonly recordFields: ReadonlyArray<RecordDrawerField>
  readonly values: Values
  readonly table: string | undefined
  readonly recordId: string | undefined
  readonly setOpen: (open: boolean) => void
  readonly setError: (error: string | undefined) => void
  /** The refused save's message, in the page language; English when the host gave none. */
  readonly failedLabel: string | undefined
}

/** The fields a save sends: neither a structured block nor one the reader may not write. */
const writableFields = (fields: ReadonlyArray<RecordDrawerField>): readonly RecordDrawerField[] =>
  fields.filter((field) => !isStructured(field) && field.readOnly !== true)

/** The first required field left blank, which stops the save. */
const firstBlankRequired = (
  fields: readonly RecordDrawerField[],
  values: Values
): RecordDrawerField | undefined =>
  fields.find((field) => field.required === true && (values[field.name] ?? '').trim().length === 0)

/** The words a blank required field is refused with — the form's own. */
const requiredMessage = (field: RecordDrawerField): string =>
  field.requiredMessage ?? `${field.label ?? field.name} is required`

/** Validate + PATCH the writable fields; dispatches a grid refresh on success. */
export function useRecordSave(params: SaveParams): () => void {
  const { recordFields, values, table, recordId, setOpen, setError, failedLabel } = params
  const save = useCallback(async () => {
    const writable = writableFields(recordFields)
    const blank = firstBlankRequired(writable, values)
    if (blank) {
      setError(requiredMessage(blank))
      return
    }
    if (!table || !recordId) return
    const payload = Object.fromEntries(writable.map((f) => [f.name, toWireValue(f, values)]))
    const res = await fetch(`/api/tables/${table}/records/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      setError(failedLabel ?? 'Operation failed')
      return
    }
    dispatch('sovrium:crud-success', { table, operation: 'update', recordId })
    setOpen(false)
  }, [recordFields, values, table, recordId, setOpen, setError, failedLabel])
  return useCallback(() => void save(), [save])
}
