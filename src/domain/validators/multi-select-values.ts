/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { optionValue } from '@/domain/models/app/tables/fields/field-types/validation-utils'

type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

export type UndeclaredMultiSelectValues = {
  readonly field: string
  readonly invalid: readonly string[]
  readonly allowed: readonly string[]
}

export type MultiSelectSelectionOverflow = {
  readonly field: string
  readonly maxSelections: number
  readonly selected: number
}

const selectedValues = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return []
  return value.map((element) => (typeof element === 'string' ? element : String(element)))
}

const declaredOptionValues = (field: FieldDeclaration): readonly string[] => {
  if (!('options' in field) || !Array.isArray(field.options)) return []
  return field.options.map(optionValue)
}

export const findUndeclaredMultiSelectValues = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly UndeclaredMultiSelectValues[] =>
  tableFields.flatMap((field) => {
    if (field.type !== 'multi-select' || !(field.name in values)) return []
    const allowed = declaredOptionValues(field)
    const invalid = selectedValues(values[field.name]).filter((value) => !allowed.includes(value))
    return invalid.length > 0 ? [{ field: field.name, invalid, allowed }] : []
  })

export const findMultiSelectSelectionOverflows = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly MultiSelectSelectionOverflow[] =>
  tableFields.flatMap((field) => {
    if (field.type !== 'multi-select' || !(field.name in values)) return []
    if (!('maxSelections' in field) || typeof field.maxSelections !== 'number') return []
    const { maxSelections } = field
    const selected = selectedValues(values[field.name]).length
    return selected > maxSelections ? [{ field: field.name, maxSelections, selected }] : []
  })
