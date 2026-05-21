/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { isRecordReadOnly } from '@/domain/validators/field-condition-evaluator'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import type { Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { Context } from 'hono'

export interface FieldConditionCheckInput {
  readonly c: Context
  readonly table: Table | undefined
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly recordId: string
}

export async function checkFieldConditionReadOnly(
  input: FieldConditionCheckInput
): Promise<Response | undefined> {
  const { c, table, session, tableName, recordId } = input
  const hasConditions = table?.fields?.some(
    (field) =>
      'conditions' in field && Array.isArray(field.conditions) && field.conditions.length > 0
  )
  if (!table || !hasConditions) return undefined

  const fetched = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
  if (fetched._tag === 'Left' || !fetched.right) return undefined

  if (isRecordReadOnly(table.fields, fetched.right as Readonly<Record<string, unknown>>)) {
    return c.json(
      {
        success: false,
        message: 'Cannot update record: a field condition has made this record read-only',
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }
  return undefined
}

export function validateUpdateReadonlyFields(
  fields: Record<string, unknown>,
  c: Context
): Response | undefined {
  const READONLY_FIELDS = new Set(['id', 'created_at', 'updated_at'])
  const attempted = Object.keys(fields).filter((field) => READONLY_FIELDS.has(field))
  if (attempted.length === 0) return undefined
  return c.json(
    {
      success: false,
      message: `Cannot write to readonly field '${attempted[0]!}'`,
      code: 'VALIDATION_ERROR',
    },
    400
  )
}

export function validateUpdateForbiddenFields(
  forbiddenFields: readonly string[],
  c: Context
): Response | undefined {
  const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])
  const attempted = forbiddenFields.filter((field) => !SYSTEM_PROTECTED_FIELDS.has(field))
  if (attempted.length === 0) return undefined
  const firstForbiddenField = attempted[0]!
  return c.json(
    {
      success: false,
      message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
      code: 'FORBIDDEN',
      field: firstForbiddenField,
    },
    403
  )
}
