/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  findComputedFieldWrites,
  readonlyFieldWriteMessage,
} from '@/domain/models/app/tables/computed-field-write-validation'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { checkRecordUpdateValues, findReadonlyUpdateField } from './record-rules'
import { FieldValidationError, formatValidationError, provideValidationContext } from './validation'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Reject an update that targets an engine-managed readonly column
 * (`id`, `created_at`, `updated_at`). Returns a `400` response or `undefined`.
 */
export function validateUpdateReadonlyFields(
  fields: Record<string, unknown>,
  c: Context
): Response | undefined {
  const attempted = findReadonlyUpdateField(fields)
  if (attempted === undefined) return undefined
  return c.json(
    {
      success: false,
      message: `Cannot write to readonly field '${attempted}'`,
      code: 'VALIDATION_ERROR',
    },
    400
  )
}

/**
 * Refuse an update that names a computed field (`formula`, `rollup`, `count`,
 * `lookup`, `autonumber`) — a value or a `null` clear alike — with the create
 * path's 400: `field` is the first in the table's field order, `errors` lists
 * every one. Run AFTER the table- and row-level update gates, so a caller who
 * may not update the record gets its 404 and never learns a computed column's
 * name, and on the fields she may WRITE: a computed field she may not write is
 * the field-permission rule's, answered as any field she may not write.
 */
export function validateUpdateComputedFields(
  table: Table | undefined,
  fields: Readonly<Record<string, unknown>>,
  c: Context
): Response | undefined {
  const attempted = findComputedFieldWrites(table?.fields, [fields])
  const [first] = attempted
  if (first === undefined) return undefined
  const errors = attempted.map((field) => ({ field, message: readonlyFieldWriteMessage(field) }))
  return formatValidationError(
    new FieldValidationError({ message: readonlyFieldWriteMessage(first), field: first, errors }),
    c
  )
}

/** The request and payload a per-value update rule is evaluated against. */
export interface UpdateValueCheck {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly fields: Record<string, unknown>
}

/**
 * Every per-VALUE rule the update path enforces — `checkRecordUpdateValues`,
 * the one composition the MCP update tool runs too — on the request's domain
 * runtime (attachment confinement reads the storage catalog, an inline
 * attachment is stored). Answers the values to write, or the first violation
 * for the caller to render through the shared `formatValidationError`, which is
 * what keeps the update path's wire shape and statuses (422 format, 400
 * cardinality) from drifting from the create path's.
 */
export const checkedUpdateValues = (input: Readonly<UpdateValueCheck>) => {
  const { c, app, tableName, userRole, fields } = input
  const { userGroups, session } = getTableContext(c)
  return checkRecordUpdateValues(fields).pipe(
    provideValidationContext(app, tableName, {
      role: userRole,
      groups: userGroups,
      signedOut: isGuestSession(session.userId),
    }),
    Effect.result
  )
}

/**
 * Reject an update that targets a field the user's role cannot write
 * (per field-level permissions). `user_id` is system-protected and silently
 * ignored. Returns a `404` response (S1 anti-enumeration — the
 * field-permission boundary is not discoverable; field name is dropped) or
 * `undefined`.
 */
export function validateUpdateForbiddenFields(
  forbiddenFields: readonly string[],
  c: Context
): Response | undefined {
  const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])
  const attempted = forbiddenFields.filter((field) => !SYSTEM_PROTECTED_FIELDS.has(field))
  if (attempted.length === 0) return undefined
  return notFound(c)
}
