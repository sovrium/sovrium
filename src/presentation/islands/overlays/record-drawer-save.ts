/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The record drawer's Save: check, then PATCH what its reader may write — or,
 * opened with no record, POST a new one.
 *
 * What is sent is what the reader may write and nothing else: a structured
 * `renderAs` block and a field stamped `readOnly` (one their role may not
 * write, or a computed, AI or stamped field) never leave the drawer, so a save
 * is never refused for a value the reader did not touch.
 *
 * Two checks run before anything is sent. A JSON field whose text does not
 * parse is refused under the field. A REQUIRED field left blank is refused too:
 * for an edit with the form's banner, as it always was; for a new record under
 * the field itself, the way the grid's create dialog marks it, because there
 * every required field starts blank.
 *
 * A create the server refuses keeps the drawer open with what was typed: a
 * message about a field lands under that field, and any other failure is one
 * designed sentence — never the response body.
 */

import { useCallback } from 'react'
import { dispatch } from '@/presentation/islands/runtime/event-bus'
import { readFieldErrors } from '@/presentation/islands/runtime/write-refusal'
import { isStructured, type RecordDrawerField } from './record-drawer-field'
import {
  droppedLinkFields,
  invalidJsonFields,
  toEntryWireValue,
  type Values,
} from './record-drawer-values'

export type FieldErrors = Readonly<Record<string, string>>

export interface SaveParams {
  readonly recordFields: ReadonlyArray<RecordDrawerField>
  readonly values: Values
  readonly table: string | undefined
  readonly recordId: string | undefined
  /** The record as loaded, against which a removed link is found. */
  readonly record?: Readonly<Record<string, unknown>>
  /** Opened with no record: Save creates one. */
  readonly creating?: boolean
  readonly setOpen: (open: boolean) => void
  readonly setError: (error: string | undefined) => void
  readonly setFieldErrors: (errors: FieldErrors) => void
  /** The words the drawer refuses with, in the page language; English when absent. */
  readonly words: SaveWords
}

/** The words a refused save is told in. */
export interface SaveWords {
  /** A refused edit. */
  readonly failed?: string | undefined
  /** A create refused for a reason about no field. */
  readonly createFailed?: string | undefined
  /** A JSON field whose text does not parse. */
  readonly invalidJson?: string | undefined
}

const CREATE_FAILED = 'Couldn’t save the record. Try again.'
const INVALID_JSON = 'Enter valid JSON.'

/** The fields a save sends: neither a structured block nor one the reader may not write. */
const writableFields = (fields: ReadonlyArray<RecordDrawerField>): readonly RecordDrawerField[] =>
  fields.filter(
    (field) =>
      !isStructured(field) && field.readOnly !== true && !field.button && field.type !== 'button'
  )

const isBlank = (values: Values, field: RecordDrawerField): boolean =>
  (values[field.name] ?? '').trim().length === 0

/** The words a blank required field is refused with — the form's own. */
const requiredMessage = (field: RecordDrawerField): string =>
  field.requiredMessage ?? `${field.label ?? field.name} is required`

/** What stops a save before it is sent: invalid JSON per field, then a blank required one. */
function refusedBeforeSending(
  writable: readonly RecordDrawerField[],
  values: Values,
  creating: boolean,
  words: SaveWords
): { readonly fields: FieldErrors; readonly banner?: string } {
  const invalidJson = words.invalidJson ?? INVALID_JSON
  const json = Object.fromEntries(
    invalidJsonFields(writable, values).map((name) => [name, invalidJson])
  )
  const blanks = writable.filter((field) => field.required === true && isBlank(values, field))
  if (creating) {
    const required = Object.fromEntries(blanks.map((f) => [f.name, requiredMessage(f)]))
    return { fields: { ...required, ...json } }
  }
  const first = blanks[0]
  return { fields: json, ...(first === undefined ? {} : { banner: requiredMessage(first) }) }
}

/** What a POST answered: the new id, or the per-field messages, or the one sentence. */
type CreateOutcome = { readonly id: string } | { readonly refused: FieldErrors | string }

async function postNewRecord(
  table: string,
  fields: Readonly<Record<string, unknown>>,
  failed: string
): Promise<CreateOutcome> {
  const res = await fetch(`/api/tables/${table}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const body = (await res.json().catch(() => undefined)) as Record<string, unknown> | undefined
  if (res.ok) return { id: String(body?.['id'] ?? '') }
  const fieldErrors = res.status < 500 ? readFieldErrors(body) : undefined
  return { refused: fieldErrors ?? failed }
}

/** One PATCH: whether the records API took it. */
async function patchOnce(
  table: string,
  recordId: string,
  payload: Readonly<Record<string, unknown>>
): Promise<boolean> {
  const res = await fetch(`/api/tables/${table}/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.ok
}

/**
 * The PATCH of an edit: whether the records API took it. A multi-valued link
 * the edit removed a record from is first written empty — the one write that
 * unlinks — then with the links it keeps.
 */
async function patchRecord(
  table: string,
  recordId: string,
  payload: Readonly<Record<string, unknown>>,
  dropped: readonly string[]
): Promise<boolean> {
  if (dropped.length > 0) {
    const cleared = Object.fromEntries(dropped.map((name) => [name, []]))
    if (!(await patchOnce(table, recordId, cleared))) return false
  }
  return patchOnce(table, recordId, payload)
}

/** Create the record; `false` when refused, with the refusal drawn. */
async function createRecord(
  params: SaveParams,
  table: string,
  writable: readonly RecordDrawerField[]
): Promise<boolean> {
  const { values, words } = params
  const filled = writable.filter((field) => !isBlank(values, field))
  const fields = Object.fromEntries(filled.map((f) => [f.name, toEntryWireValue(f, values)]))
  const outcome = await postNewRecord(table, fields, words.createFailed ?? CREATE_FAILED)
  if ('refused' in outcome) {
    if (typeof outcome.refused === 'string') params.setError(outcome.refused)
    else params.setFieldErrors(outcome.refused)
    return false
  }
  dispatch('sovrium:crud-success', { table, operation: 'create', recordId: outcome.id })
  return true
}

/** Update the record; `false` when refused, with the refusal drawn. */
async function updateRecord(
  params: SaveParams,
  table: string,
  writable: readonly RecordDrawerField[]
): Promise<boolean> {
  const { values, recordId, words } = params
  if (!recordId) return false
  const payload = Object.fromEntries(writable.map((f) => [f.name, toEntryWireValue(f, values)]))
  const dropped = droppedLinkFields(writable, values, params.record ?? {})
  if (!(await patchRecord(table, recordId, payload, dropped))) {
    params.setError(words.failed ?? 'Operation failed')
    return false
  }
  dispatch('sovrium:crud-success', { table, operation: 'update', recordId })
  return true
}

/** Validate, then PATCH the writable fields — or POST a new record; refreshes the grid. */
export function useRecordSave(params: SaveParams): () => Promise<void> {
  const { recordFields, values, table, recordId, creating = false, words, record } = params
  const { setOpen, setError, setFieldErrors } = params
  return useCallback(async () => {
    const writable = writableFields(recordFields)
    const refused = refusedBeforeSending(writable, values, creating, words)
    setFieldErrors(refused.fields)
    setError(refused.banner)
    if (refused.banner !== undefined || Object.keys(refused.fields).length > 0 || !table) return
    const current = { recordFields, values, table, recordId, record, creating, words }
    const write = { ...current, setOpen, setError, setFieldErrors }
    const saved = creating
      ? await createRecord(write, table, writable)
      : await updateRecord(write, table, writable)
    if (saved) setOpen(false)
  }, [
    recordFields,
    values,
    table,
    recordId,
    record,
    creating,
    words,
    setOpen,
    setError,
    setFieldErrors,
  ])
}
