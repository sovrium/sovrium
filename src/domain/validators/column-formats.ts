/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isValidEmail } from '@/domain/utils/email-validation'

export const FORMAT_CONSTRAINED_FIELD_TYPES = ['email', 'url'] as const

export type FormatConstrainedFieldType = (typeof FORMAT_CONSTRAINED_FIELD_TYPES)[number]

export type ColumnFormatViolation = {
  readonly field: string
  readonly type: FormatConstrainedFieldType
}

type FieldDeclaration = {
  readonly name: string
  readonly type: string
}

export const isWellFormedUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol.length > 0
  } catch {
    return false
  }
}

const FORMAT_PREDICATES: Readonly<Record<FormatConstrainedFieldType, (value: string) => boolean>> =
  {
    email: isValidEmail,
    url: isWellFormedUrl,
  }

const isFormatConstrained = (type: string): type is FormatConstrainedFieldType =>
  (FORMAT_CONSTRAINED_FIELD_TYPES as readonly string[]).includes(type)

const violatesFormat = (type: FormatConstrainedFieldType, value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false
  if (typeof value !== 'string') return true
  return !FORMAT_PREDICATES[type](value)
}

export const findColumnFormatViolations = (
  tableFields: readonly FieldDeclaration[],
  values: Readonly<Record<string, unknown>>
): readonly ColumnFormatViolation[] =>
  tableFields
    .filter(
      (field) =>
        isFormatConstrained(field.type) &&
        field.name in values &&
        violatesFormat(field.type, values[field.name])
    )
    .map((field) => ({ field: field.name, type: field.type as FormatConstrainedFieldType }))
