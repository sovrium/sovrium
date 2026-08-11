/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { markUserAuthoredAiFieldsForRecords } from '@/application/use-cases/ai-compute/enqueue-refinement'
import { batchDeleteProgram, batchUpdateProgram } from '@/application/use-cases/tables/programs'
import { isSafeRedirectPath } from '@/domain/utils/redirect-safety'
import { hasDeletePermission, hasUpdatePermission } from '@/domain/validators/permission-evaluators'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { formatValidationError } from '@/presentation/api/validation'
import {
  sanitizeUpdateRichTextFields,
  validateUpdateFieldValues,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from '../record/record-update-guards'
import { filterAllowedFieldsWithRole } from '../record/record-update-handler'
import { enforceBulkMutationGate, resolveGuardForTable } from '../record/row-level-guard'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Parse JSON from a form field, returning empty array/object on failure.
 */
function parseJsonField<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Handle form-based bulk DELETE with redirect.
 *
 * Accepts POST with form body containing:
 * - _ids: JSON array of record IDs
 * - _redirect: path to redirect after operation
 *
 * Uses synchronous navigation to ensure DB writes complete before
 * the browser proceeds (eliminates race conditions in E2E tests).
 */
export async function handleFormBulkDelete(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (!guard && !hasDeletePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to delete records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  const body = await c.req.parseBody()
  const ids = parseJsonField<readonly string[]>(body['_ids'], [])
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  if (ids.length === 0) {
    return c.json({ success: false, message: 'No records specified', code: 'BAD_REQUEST' }, 400)
  }

  // Z-3: row-level scoping — every id in the batch must individually
  // satisfy the read+delete predicates. Atomic-fail on any miss to avoid
  // the partial-success enumeration oracle.
  if (guard) {
    const gateError = await enforceBulkMutationGate({
      c,
      table,
      session,
      tableName,
      ids,
      guard,
      op: 'delete',
    })
    if (gateError) return gateError
  }

  // eslint-disable-next-line functional/no-expression-statements -- Side effect: execute batch delete
  await runTableProgram(batchDeleteProgram(session, tableName, ids, false))

  // The path arrives in the request body, so it is only honoured once proven
  // same-origin — otherwise it is an open redirect off this site.
  if (isSafeRedirectPath(redirectPath)) {
    return c.redirect(redirectPath, 302)
  }

  return c.json({ success: true }, 200)
}

/**
 * Run every per-FIELD and per-VALUE update rule the single-record JSON verb
 * runs (`handleUpdateRecord`, record-write-handlers.ts:482-538) over the field
 * map a bulk-update would apply, in the same order: engine-managed readonly
 * columns, then field-level write permissions, then per-value rules, then
 * `rich-text` HTML sanitization.
 *
 * Returns the refusal `Response` for the first violated rule, or the field map
 * to write. This is why the bulk verb needs it at all: `batchUpdateRecords`
 * builds `UPDATE <table> SET <every supplied key>` from the parsed blob
 * verbatim, so without these rules a caller could write a column their role
 * cannot write — across every row they can address — and be told it succeeded.
 *
 * Every rule runs BEFORE the write, so the refusal is atomic: a payload mixing
 * a permitted column with a refused one writes NEITHER, on any targeted row. A
 * partially-applied bulk write is not an admissible outcome — silently dropping
 * the refused key across N rows would report success for a write that did not
 * happen.
 *
 * Only the columns the payload SUPPLIES are inspected, which is what keeps a
 * legitimate bulk write working: a column absent from `_data` is neither
 * validated nor written, and a column carrying no explicit `permissions.fields`
 * entry stays writable.
 */
async function resolveBulkUpdateFields(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly data: Record<string, unknown>
}): Promise<{ readonly refusal: Response } | { readonly fields: Record<string, unknown> }> {
  const { c, app, tableName, userRole, data } = input

  const readonlyError = validateUpdateReadonlyFields(data, c)
  if (readonlyError) return { refusal: readonlyError }

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    userRole,
    data
  )
  // S1 anti-enumeration: a field the role cannot write refuses the whole
  // request with 404 rather than dropping the key, so the field-permission
  // boundary stays undiscoverable — the contract the JSON verb pins.
  const forbiddenError = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenError) return { refusal: forbiddenError }

  const valueError = await validateUpdateFieldValues(app, tableName, userRole, allowedData)
  if (valueError) return { refusal: formatValidationError(valueError, c) }

  // `rich-text` columns are HTML-sanitized last, on the map that survived the
  // gates above — the same shared rule and the same position the single-record
  // verb runs it in (record-write-handlers.ts:538). Unlike its siblings this
  // one TRANSFORMS the write rather than refusing it, so the sanitized map is
  // what this helper returns and therefore what reaches every targeted row:
  // computing it without feeding it forward would leave the raw markup on the
  // column while every gate reported success.
  return { fields: await sanitizeUpdateRichTextFields(app, tableName, userRole, allowedData) }
}

/**
 * The bulk-update REQUEST gates, in their established order: the table-level
 * update permission (403), the empty-target check (400), then the Z-3
 * row-level gate over every targeted id (404). Returns the refusal `Response`,
 * or `undefined` when the write may proceed.
 *
 * Extracted for the same reason `resolveFormUpdateAuth` is on the single-record
 * form verb (record-write-handlers.ts) — it keeps the handler within the
 * per-function size limits now that the field and value rules run there too.
 * Each check's behaviour AND its position relative to the others is unchanged
 * from when they sat inline, so no request changes status as a result of the
 * extraction.
 */
async function resolveBulkUpdateGates(input: {
  readonly c: Context
  readonly app: App
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly tableName: string
  readonly userRole: string
  readonly ids: readonly string[]
}): Promise<Response | undefined> {
  const { c, app, session, tableName, userRole, ids } = input

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(session, userRole, table, app)

  if (!guard && !hasUpdatePermission(table, userRole, app.tables)) {
    return c.json(
      {
        success: false,
        message: 'You do not have permission to update records in this table',
        code: 'FORBIDDEN',
      },
      403
    )
  }

  if (ids.length === 0) {
    return c.json({ success: false, message: 'No records specified', code: 'BAD_REQUEST' }, 400)
  }

  // Z-3: row-level scoping — every id must individually satisfy
  // read+write predicates. Atomic-fail on any miss.
  if (!guard) return undefined
  return enforceBulkMutationGate({ c, table, session, tableName, ids, guard, op: 'write' })
}

/**
 * Handle form-based bulk UPDATE with redirect.
 *
 * Accepts POST with form body containing:
 * - _ids: JSON array of record IDs
 * - _data: JSON object of field values to apply
 * - _redirect: path to redirect after operation
 *
 * Uses synchronous navigation to ensure DB writes complete before
 * the browser proceeds (eliminates race conditions in E2E tests).
 */
export async function handleFormBulkUpdate(c: Context, app: App) {
  const { session, tableName, userRole } = getTableContext(c)

  const body = await c.req.parseBody()
  const ids = parseJsonField<readonly string[]>(body['_ids'], [])
  const data = parseJsonField<Record<string, unknown>>(body['_data'], {})
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  const gateError = await resolveBulkUpdateGates({ c, app, session, tableName, userRole, ids })
  if (gateError) return gateError

  // Per-FIELD and per-VALUE rules, after the authz gates above so an
  // unauthorized caller is refused before learning anything about the payload.
  const resolved = await resolveBulkUpdateFields({ c, app, tableName, userRole, data })
  if ('refusal' in resolved) return resolved.refusal

  const recordsData = ids.map((id) => ({ id, fields: resolved.fields }))

  // eslint-disable-next-line functional/no-expression-statements -- Side effect: execute batch update
  await runTableProgram(
    batchUpdateProgram({ session, tableName, recordsData, returnRecords: false, app })
  )

  // [internal ref] Phase 2: same rule as every other write path — a column the user
  // wrote by hand is no longer reported as a failed computed fallback.
  markUserAuthoredAiFieldsForRecords({ app, tableName, records: recordsData })

  // The path arrives in the request body, so it is only honoured once proven
  // same-origin — otherwise it is an open redirect off this site.
  if (isSafeRedirectPath(redirectPath)) {
    return c.redirect(redirectPath, 302)
  }

  return c.json({ success: true }, 200)
}
