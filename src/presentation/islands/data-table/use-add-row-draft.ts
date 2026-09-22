/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { coerceFieldValues, isComputedFieldType } from '../runtime/field-value-coercion'
import { postRecord } from './island/create-record-data'
import type { SelectOptionLike } from '@/domain/models/app/tables/select-option'

/**
 * One column of the trailing add-row, as the row needs to know it: which
 * field it writes, what the reader calls it, what it takes, and whether a
 * record can be created without it.
 *
 * `field` is absent for the generated columns — the selection checkbox, the
 * row number, the action cluster — which the row must still span so its cells
 * line up under the grid's, but which hold nothing a new record could carry.
 */
export interface AddRowColumn {
  readonly field?: string
  readonly label: string
  readonly type?: string
  readonly required: boolean
  readonly options?: readonly SelectOptionLike[]
}

/** Whether a column takes a value on create at all. */
export const isWritableAddRowColumn = (column: AddRowColumn): boolean =>
  column.field !== undefined && !isComputedFieldType(column.type)

interface AddRowDraftState {
  /** Whether the row is activated — showing one control per column — or resting on its trigger. */
  readonly open: boolean
  /** What the reader has typed, by field. Never includes the prefill. */
  readonly values: Readonly<Record<string, unknown>>
  /** The refusal keeping the row open, named for the reader. */
  readonly error?: string
  /** The field whose bespoke editor (a picker, a date control) is open. */
  readonly activeEditor?: string
  readonly saving: boolean
}

const RESTING: AddRowDraftState = { open: false, values: {}, saving: false }

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/**
 * The first reason a draft cannot be posted, or `undefined` when it can.
 *
 * Required columns are checked HERE, before any request goes out, so the
 * refusal names the column in the words the rest of the suite already uses
 * (`<Label> is required`) and the draft stays exactly as typed — a refusal
 * that also erased the draft would punish the reader twice for one mistake.
 */
function firstRefusal(
  columns: readonly AddRowColumn[],
  values: Readonly<Record<string, unknown>>
): string | undefined {
  const missing = columns.find(
    (column) =>
      isWritableAddRowColumn(column) && column.required && isBlank(values[column.field ?? ''])
  )
  return missing === undefined ? undefined : `${missing.label} is required`
}

/** The typed field map a draft posts: coerced by the shared rule, blanks left off. */
function buildFields(
  columns: readonly AddRowColumn[],
  values: Readonly<Record<string, unknown>>
): { readonly fields: Record<string, unknown>; readonly refused?: string } {
  const writable = columns.filter(isWritableAddRowColumn)
  const types = new Map(writable.map((column) => [column.field ?? '', column.type ?? '']))
  const labelOf = (field: string): string =>
    writable.find((column) => column.field === field)?.label ?? field
  const present = Object.fromEntries(
    Object.entries(values).filter(([field, value]) => types.has(field) && !isBlank(value))
  )
  const { accepted, refused } = coerceFieldValues(present, types, labelOf)
  const [first] = refused
  return {
    fields: Object.fromEntries(Object.entries(accepted).filter(([, value]) => value !== null)),
    ...(first && { refused: first.reason }),
  }
}

/**
 * The draft behind one trailing add-row: its activation, the values typed
 * into it, the refusal keeping it open, and the commit that turns it into a
 * record.
 *
 * `prefill` is what the row's PLACE already says about the record — the
 * group value on a grouped grid — and is merged under the reader's own
 * values at commit time, never shown as something they typed.
 */
export function useAddRowDraft(params: {
  readonly tableName: string
  readonly columns: readonly AddRowColumn[]
  readonly prefill: Readonly<Record<string, unknown>>
  readonly onCreated: () => void
}) {
  const { tableName, columns, prefill, onCreated } = params
  const [state, setState] = useState<AddRowDraftState>(RESTING)

  const open = useCallback((): void => setState({ ...RESTING, open: true }), [])
  const discard = useCallback((): void => setState(RESTING), [])
  const setValue = useCallback(
    (field: string, value: unknown): void =>
      setState((current) => ({ ...current, values: { ...current.values, [field]: value } })),
    []
  )
  const openEditor = useCallback(
    (field: string): void => setState((current) => ({ ...current, activeEditor: field })),
    []
  )
  const closeEditor = useCallback(
    (): void => setState((current) => ({ ...current, activeEditor: undefined })),
    []
  )

  const commit = useCallback((): void => {
    setState((current) => {
      if (!current.open || current.saving) return current
      const values = { ...prefill, ...current.values }
      const refusal = firstRefusal(columns, values)
      if (refusal !== undefined) return { ...current, error: refusal }
      const { fields, refused } = buildFields(columns, values)
      if (refused !== undefined) return { ...current, error: refused }
      void postRecord(tableName, fields).then((outcome) => {
        if (outcome.ok) {
          setState(RESTING)
          onCreated()
          return
        }
        setState((later) => ({
          ...later,
          saving: false,
          error: outcome.message ?? 'The record could not be created.',
        }))
      })
      return { ...current, saving: true, error: undefined }
    })
  }, [columns, prefill, tableName, onCreated])

  return { state, open, discard, setValue, openEditor, closeEditor, commit }
}
