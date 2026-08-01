/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { rawGetRecordProgram } from '@/application/use-cases/tables/programs'
import { isRecordReadOnly } from '@/domain/validators/field-condition-evaluator'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import {
  createValidationLayer,
  sanitizeRichTextFields,
  validateFieldFormats,
  validateMultiSelectOptions,
  validateMultiSelectSelectionLimits,
} from '@/presentation/api/validation'
import type { App, Table } from '@/domain/models/app'
import type { getTableContext } from '@/presentation/api/utils/context-helpers'
import type { FieldFormatError, FieldValidationError } from '@/presentation/api/validation'
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

async function validateUpdateFieldFormats(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<FieldFormatError | undefined> {
  const result = await Effect.runPromise(
    validateFieldFormats(fields).pipe(
      Effect.provide(createValidationLayer(app, tableName, userRole)),
      Effect.either
    )
  )
  return result._tag === 'Left' ? result.left : undefined
}

async function validateUpdateMultiSelectValues(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<FieldFormatError | FieldValidationError | undefined> {
  const layer = createValidationLayer(app, tableName, userRole)
  const membership = await Effect.runPromise(
    validateMultiSelectOptions(fields).pipe(Effect.provide(layer), Effect.either)
  )
  if (membership._tag === 'Left') return membership.left
  const cardinality = await Effect.runPromise(
    validateMultiSelectSelectionLimits(fields).pipe(Effect.provide(layer), Effect.either)
  )
  return cardinality._tag === 'Left' ? cardinality.left : undefined
}

export async function validateUpdateFieldValues(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<FieldFormatError | FieldValidationError | undefined> {
  const formatError = await validateUpdateFieldFormats(app, tableName, userRole, fields)
  if (formatError) return formatError
  return validateUpdateMultiSelectValues(app, tableName, userRole, fields)
}

export async function sanitizeUpdateRichTextFields(
  app: App,
  tableName: string,
  userRole: string,
  fields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return Effect.runPromise(
    sanitizeRichTextFields(fields).pipe(
      Effect.provide(createValidationLayer(app, tableName, userRole))
    )
  )
}

export function validateUpdateForbiddenFields(
  forbiddenFields: readonly string[],
  c: Context
): Response | undefined {
  const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])
  const attempted = forbiddenFields.filter((field) => !SYSTEM_PROTECTED_FIELDS.has(field))
  if (attempted.length === 0) return undefined
  return c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
  )
}
