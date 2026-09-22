/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import { transformRecord } from '@/application/use-cases/tables/record-transformer'
import { hasUpdatePermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { validateFieldWritePermissions } from '@/presentation/api/runtime/field-permission-validator'
import { handleRouteError } from './error-handlers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Names omitted from the `forbiddenFields` list reported back to the caller, so
 * an error response never enumerates an internal column name. This is the set's
 * ONLY remaining role — it must NOT be used to strip fields from a write. Doing
 * so dropped the column silently while still returning 201/200, which is data
 * loss rather than protection; genuinely readonly fields are rejected loudly and
 * by TYPE in `validateReadonlyIdField` / `validateReadonlyComputedFields`.
 */
const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

/**
 * Check if the caller has table-level update permission (using the pre-fetched
 * identity from middleware).
 *
 * Takes the caller's EFFECTIVE ROLES — their global role plus a `group:<name>`
 * entry per membership — not a bare role, and evaluates them
 * most-permissive-wins. A bare role can never match a `group:` entry, because
 * that overlay exists only in the effective-role set `buildEffectiveRoles`
 * produces; passing one left every `group:` update grant silently inert while
 * the sibling create gate honoured it.
 */
export function checkTableUpdatePermissionWithRole(
  app: App,
  tableName: string,
  effectiveRoles: readonly string[],
  c: Context
): { allowed: true } | { allowed: false; response: Response } {
  const table = app.tables?.find((t) => t.name === tableName)

  if (!hasUpdatePermissionForRoles(table, effectiveRoles, app.tables)) {
    // S1 anti-enumeration: authz denial returns 404 with a generic envelope.
    // The pre-S1 code branched on `userRole === 'viewer'` to customise the
    // error message; that branch is intentionally removed so the response
    // shape stays uniform regardless of which role triggered the denial.
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
        404
      ),
    }
  }

  return { allowed: true }
}

/**
 * Filter update data to only include fields user has permission to modify (using pre-fetched role from middleware)
 */
export function filterAllowedFieldsWithRole(
  app: App,
  tableName: string,
  userRole: string,
  data: Record<string, unknown>
): {
  allowedData: Record<string, unknown>
  forbiddenFields: readonly string[]
} {
  const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, data)

  // Filter out forbidden fields only. `SYSTEM_PROTECTED_FIELDS` is deliberately
  // NOT applied here: stripping a name-matched column from the write silently
  // dropped it while the PATCH still reported 200. The set's remaining, valid
  // purpose is 403/404-suppression in `handleNoAllowedFields` below.
  const allowedData = Object.fromEntries(
    Object.entries(data).filter(([fieldName]) => !forbiddenFields.includes(fieldName))
  )

  return { allowedData, forbiddenFields }
}

/**
 * Handle case where no fields are allowed after filtering
 */
export async function handleNoAllowedFields(config: {
  recordId: string
  forbiddenFields: readonly string[]
  app: App
  c: Context
}): Promise<Response> {
  const { recordId, forbiddenFields, app, c } = config
  // Both callers derive these from the same `getTableContext(c)`, so reading
  // them here keeps the caller-supplied set down to what is genuinely local.
  const { session, tableName, userRole } = getTableContext(c)
  // Filter out system-protected fields from forbidden list
  const attemptedForbiddenFields = forbiddenFields.filter(
    (field) => !SYSTEM_PROTECTED_FIELDS.has(field)
  )

  // S1 anti-enumeration: forbidden-field attempts return 404 (not 403) so
  // the field-permission boundary is not discoverable. The attempted field
  // names are intentionally omitted from the response envelope.
  if (attemptedForbiddenFields.length > 0) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // If only system-protected fields were filtered, return unchanged record
  try {
    const result = await runTableProgram(rawGetRecordProgram(session, tableName, recordId))
    if (result._tag === 'Failure') {
      return handleRouteError(c, result.failure)
    }
    const record = result.success

    if (!record) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    // This is the ONLY PATCH branch that emits the `{ record }` envelope, and
    // it used to serve `rawGetRecordProgram`'s output verbatim — a program that
    // receives neither `app` nor `userRole` and so structurally cannot filter.
    // A PATCH whose body reduced to exactly the system-protected `user_id`
    // cleared the 404 guard above and echoed every read-restricted column on
    // the row. Route it through the same canonical filter every other
    // record-bearing response uses.
    const readable = filterReadableFields({ app, tableName, userRole, record })
    return c.json({ record: transformRecord(readable, { app, tableName }) }, 200)
  } catch (error) {
    return handleRouteError(c, error)
  }
}
