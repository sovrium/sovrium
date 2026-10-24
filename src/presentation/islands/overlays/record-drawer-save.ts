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
import { consoleRequestIdOf } from '@/presentation/islands/runtime/console-request-id'
import { dispatch } from '@/presentation/islands/runtime/event-bus'
import { readFieldErrors } from '@/presentation/islands/runtime/write-refusal'
import { holdsSameLinks, isLinkList } from '../parts/crud-form/record-picker-value'
import { isStructured, type RecordDrawerField } from './record-drawer-field'
import { invalidJsonFields, toEntryWireValue, type Values } from './record-drawer-values'

export type FieldErrors = Readonly<Record<string, string>>

export interface SaveParams {
  readonly recordFields: ReadonlyArray<RecordDrawerField>
  readonly values: Values
  /**
   * The values the opened record loaded with: a link list still holding them
   * is left out of the save. Absent before the record loads, or when creating.
   */
  readonly loaded?: Values | undefined
  readonly table: string | undefined
  readonly recordId: string | undefined
  /** Opened with no record: Save creates one. */
  readonly creating?: boolean
  readonly setOpen: (open: boolean) => void
  /** The banner, and the request a server error failed the save under (console only). */
  readonly setError: (error: string | undefined, requestId?: string) => void
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
  /** An edit the records API refuses as not found or forbidden. */
  readonly refused?: string | undefined
}

const CREATE_FAILED = 'Couldn’t save the record. Try again.'
const INVALID_JSON = 'Enter valid JSON.'
const REFUSED = 'You can’t change this record, or it no longer exists.'

/** The answers that say the record cannot be changed by this reader, or is gone. */
const isRefusal = (status: number): boolean => status === 403 || status === 404

/** Whether an answer took the write. */
const tookIt = (status: number): boolean => status >= 200 && status < 300

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

/**
 * What a POST answered: the new id, or the per-field messages, or the one
 * sentence — with the request a console's server error was answered under.
 */
type CreateOutcome =
  | { readonly id: string }
  | { readonly refused: FieldErrors | string; readonly requestId?: string | undefined }

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
  return { refused: fieldErrors ?? failed, requestId: consoleRequestIdOf(res.status, body) }
}

/** Whether a save sends a multi-valued link list. */
const sendsLinkList = (writable: readonly RecordDrawerField[]): boolean => writable.some(isLinkList)

/**
 * The fields an edit sends: the writable ones, less each link list that still
 * holds the ids the record loaded with, whatever their order. Each list a save
 * sends REPLACES the record's links, so an untouched one sent would take off a
 * link made meanwhile — from the linked record's side, say — that the drawer
 * never showed.
 */
const changedFields = (
  writable: readonly RecordDrawerField[],
  values: Values,
  loaded: Values | undefined
): readonly RecordDrawerField[] =>
  loaded === undefined
    ? writable
    : writable.filter(
        (field) =>
          !isLinkList(field) || !holdsSameLinks(values[field.name] ?? '', loaded[field.name] ?? '')
      )

/**
 * The PATCH of an edit: the status the records API answered. A save that sends
 * a multi-valued link list sends it as the whole set the drawer keeps
 * (`linkLists: 'replace'`), so a link taken off is removed by the same write —
 * and a refused save removes none.
 */
async function patchRecord(
  table: string,
  recordId: string,
  payload: Readonly<Record<string, unknown>>
): Promise<number> {
  const res = await fetch(`/api/tables/${table}/records/${recordId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.status
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
    if (typeof outcome.refused === 'string') params.setError(outcome.refused, outcome.requestId)
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
  const sent = changedFields(writable, values, params.loaded)
  const payload = Object.fromEntries(sent.map((f) => [f.name, toEntryWireValue(f, values)]))
  const replace = sendsLinkList(sent) ? { linkLists: 'replace' } : {}
  const status = await patchRecord(table, recordId, { ...payload, ...replace })
  if (!tookIt(status)) {
    params.setError(
      isRefusal(status) ? (words.refused ?? REFUSED) : (words.failed ?? 'Operation failed')
    )
    return false
  }
  dispatch('sovrium:crud-success', { table, operation: 'update', recordId })
  return true
}

/** Validate, then PATCH the writable fields — or POST a new record; refreshes the grid. */
export function useRecordSave(params: SaveParams): () => Promise<void> {
  const { recordFields, values, table, recordId, creating = false, words } = params
  const { setOpen, setError, setFieldErrors, loaded } = params
  return useCallback(async () => {
    const writable = writableFields(recordFields)
    const refused = refusedBeforeSending(writable, values, creating, words)
    setFieldErrors(refused.fields)
    setError(refused.banner)
    if (refused.banner !== undefined || Object.keys(refused.fields).length > 0 || !table) return
    const current = { recordFields, values, loaded, table, recordId, creating, words }
    const write = { ...current, setOpen, setError, setFieldErrors }
    const saved = creating
      ? await createRecord(write, table, writable)
      : await updateRecord(write, table, writable)
    if (saved) setOpen(false)
  }, [
    recordFields,
    values,
    loaded,
    table,
    recordId,
    creating,
    words,
    setOpen,
    setError,
    setFieldErrors,
  ])
}
