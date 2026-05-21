/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { type FieldDef } from '../components/crud-form/fields'
import { useCreateRecord, useUpdateRecord, useDeleteRecord } from '../hooks/use-table-mutations'
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
      const recordValue = fromRecord !== undefined && fromRecord !== null ? String(fromRecord) : ''
      const value = fromInitial ?? (recordValue !== '' ? recordValue : fallbackDefault)
      return [f.name, value]
    })
  )
}

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
    automationName,
    inputData,
  } = props
  const [values, setValues] = useState(() => buildInitialValues(fields, record, initialValues))
  const [state, setState] = useState<FormState>({ isPending: false })
  const resetValues = () =>
    setValues((prev) => buildResetValues(fields, prev, preserveFields ?? []))
  const ctx: SubmitContext = {
    operation,
    fields,
    recordId,
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
    automationName,
    inputData,
  }
  const handleFieldChange = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }))
  return { values, state, ctx, handleFieldChange }
}
