/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

export function validateRequiredFieldsForRecord(
  table:
    | {
        readonly name: string
        readonly fields: ReadonlyArray<{
          readonly name: string
          readonly required?: boolean
        }>
        readonly primaryKey?: {
          readonly type: string
          readonly fields?: ReadonlyArray<string>
          readonly field?: string
        }
      }
    | undefined,
  fields: Record<string, unknown>
): readonly string[] {
  if (!table) return []

  const primaryKeyFields = new Set(
    table.primaryKey?.fields ?? (table.primaryKey?.field ? [table.primaryKey.field] : [])
  )

  const autoInjectedFields = new Set<string>([])

  return table.fields
    .filter(
      (field) =>
        field.required &&
        !(field.name in fields) &&
        !primaryKeyFields.has(field.name) &&
        !autoInjectedFields.has(field.name)
    )
    .map((field) => field.name)
}

export function validateRequiredFields(
  table:
    | {
        readonly name: string
        readonly fields: ReadonlyArray<{
          readonly name: string
          readonly required?: boolean
        }>
        readonly primaryKey?: {
          readonly type: string
          readonly fields?: ReadonlyArray<string>
          readonly field?: string
        }
      }
    | undefined,
  fields: Record<string, unknown>,
  c: Context
) {
  if (!table) return undefined

  const primaryKeyFields = new Set(
    table.primaryKey?.fields ?? (table.primaryKey?.field ? [table.primaryKey.field] : [])
  )

  const autoInjectedFields = new Set<string>([])

  const missingRequiredFields = table.fields
    .filter(
      (field) =>
        field.required &&
        !(field.name in fields) &&
        !primaryKeyFields.has(field.name) &&
        !autoInjectedFields.has(field.name)
    )
    .map((field) => field.name)

  if (missingRequiredFields.length > 0) {
    return c.json(
      {
        success: false,
        message: 'Missing required fields',
        code: 'VALIDATION_ERROR',
        details: missingRequiredFields.map((field, index) => ({
          record: index,
          field,
          error: 'Required field is missing',
        })),
      },
      400
    )
  }

  return undefined
}
