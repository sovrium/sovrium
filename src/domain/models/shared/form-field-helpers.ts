/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { evaluateVisibleWhen, type FieldValue } from './visible-when-evaluator'
import type { VisibleWhenCondition } from './visible-when'

export interface FormFieldHelperShape {
  readonly kind: 'table-field' | 'standalone' | 'signature' | 'calculation' | 'section'
  readonly column?: string
  readonly name?: string
  readonly required?: boolean
  readonly visibleWhen?: VisibleWhenCondition
  readonly requiredWhen?: VisibleWhenCondition
}

export interface FormFieldsShape {
  readonly fields: ReadonlyArray<FormFieldHelperShape>
}

export const fieldSubmitIdentifier = (
  field: Readonly<FormFieldHelperShape>
): string | undefined => {
  if (field.kind === 'table-field') return field.column
  if (field.kind === 'standalone' || field.kind === 'signature') return field.name
  return undefined
}

export const isAbsentValue = (value: unknown): boolean => {
  if (value === undefined || value === null) return true
  if (typeof value === 'string' && value.trim() === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

export const toFieldValue = (value: unknown): FieldValue => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value.map((entry) =>
      typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
        ? entry
        : String(entry)
    )
  }
  return String(value)
}

export const buildConditionValueMap = (
  form: Readonly<FormFieldsShape>,
  body: Readonly<Record<string, unknown>>
): Record<string, FieldValue> =>
  form.fields.reduce<Record<string, FieldValue>>((acc, field) => {
    const identifier = fieldSubmitIdentifier(field)
    if (identifier === undefined) return acc
    if (!(identifier in body)) return acc
    return { ...acc, [identifier]: toFieldValue(body[identifier]) }
  }, {})

export const isFieldVisible = (
  field: Readonly<FormFieldHelperShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (field.visibleWhen === undefined) return true
  return evaluateVisibleWhen(field.visibleWhen, values)
}

export const isFieldRequired = (
  field: Readonly<FormFieldHelperShape>,
  values: Readonly<Record<string, FieldValue>>
): boolean => {
  if (field.requiredWhen !== undefined) return evaluateVisibleWhen(field.requiredWhen, values)
  return field.required === true
}
