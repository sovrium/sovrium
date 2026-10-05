/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { recordValueText } from '@/presentation/design/field-type-behavior'
import { readResponseToken } from '../hooks/use-save-tokens'
import { useCreateRecord, useUpdateRecord, useDeleteRecord } from '../hooks/use-table-mutations'
import { type FieldDef } from '../parts/crud-form/fields'
import { clearMarkOf, isMarkedCleared } from '../parts/crud-form/wire-values'
import { type CrudFormIslandProps, type FormState, type SubmitContext } from './types'

function buildInitialValues(
  fields: readonly FieldDef[],
  record?: Record<string, unknown>,
  initialValues?: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => {
      const fromRecord = record?.[f.name]
      const fromInitial = initialValues?.[f.name]
      const fallbackDefault = f.defaultValue !== undefined ? String(f.defaultValue) : ''
      // Object/array record values (e.g. JSONB attachment metadata
      // `{ name, url, size }`) must be JSON-serialised, not coerced via
      // `String()` (which would yield "[object Object]") so the file-field
      // island can re-parse the existing attachment in edit mode (FORM-037).
      const recordValue = recordValueText(fromRecord)
      // Initial values (from URL/external) > record (edit mode) > defaultValue (create mode)
      const value = fromInitial ?? (recordValue !== '' ? recordValue : fallbackDefault)
      return [f.name, value]
    })
  )
}

/**
 * Builds the post-reset field values for a `type: reset` onSuccess response.
 *
 * Every field is cleared to its default value, except those listed in
 * `preserveFields`, which retain their current value for rapid repeat entry.
 */
function buildResetValues(
  fields: readonly FieldDef[],
  current: Record<string, string>,
  preserveFields: readonly string[]
): Record<string, string> {
  const preserved = new Set(preserveFields)
  const cleared = buildInitialValues(fields)
  return Object.fromEntries(
    Object.entries(cleared).map(([name, value]) => [
      name,
      preserved.has(name) ? (current[name] ?? value) : value,
    ])
  )
}

/**
 * The held values with one field set. A value entered after a Clear takes the
 * field back, so its clear mark goes with it.
 */
function withFieldValue(
  prev: Record<string, string>,
  name: string,
  value: string
): Record<string, string> {
  const next = { ...prev, [name]: value }
  if (value === '' || !isMarkedCleared(prev, name)) return next
  return Object.fromEntries(Object.entries(next).filter(([key]) => key !== clearMarkOf(name)))
}

export function useCrudFormState(props: CrudFormIslandProps) {
  const {
    operation,
    table,
    fields,
    record,
    recordId,
    redirectUrl,
    successToast,
    resetOnSuccess,
    preserveFields,
    successPage,
    initialValues,
  } = props
  const [values, setValues] = useState(() => buildInitialValues(fields, record, initialValues))
  const [state, setState] = useState<FormState>({ isPending: false })
  // The version the form was filled from, then the one each save produced: a
  // second save from the same form must not conflict with the first one.
  const [updatedAt, setUpdatedAt] = useState(() => readResponseToken(record))
  const rememberUpdatedAt = (response: unknown) => {
    const token = readResponseToken(response)
    if (token !== undefined) setUpdatedAt(token)
  }
  const resetValues = () =>
    setValues((prev) => buildResetValues(fields, prev, preserveFields ?? []))
  const ctx: SubmitContext = {
    operation,
    tableName: table,
    fields,
    recordId,
    ...(updatedAt !== undefined && { updatedAt }),
    rememberUpdatedAt,
    redirectUrl,
    successToast,
    resetOnSuccess,
    preserveFields,
    successPage,
    values,
    setState,
    resetValues,
    createRecord: useCreateRecord(table),
    updateRecord: useUpdateRecord(table),
    deleteRecord: useDeleteRecord(table),
    automationName: props.automationName,
    inputData: props.inputData,
    uiStrings: props.uiStrings,
  }
  const handleFieldChange = (name: string, value: string) =>
    setValues((prev) => withFieldValue(prev, name, value))
  return { values, state, ctx, handleFieldChange }
}
