/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  batchDeleteWithSideEffects,
  batchUpdateWithSideEffects,
} from '@/application/use-cases/tables/record-batch-orchestration'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { isSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  hasDeletePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import { formatValidationError } from '@/presentation/api/tables/validation'
import {
  sanitizeUpdateRichTextFields,
  validateUpdateFieldValues,
  validateUpdateForbiddenFields,
  validateUpdateReadonlyFields,
} from './record-update-guards'
import { filterAllowedFieldsWithRole } from './record-update-permissions'
import { getLinkReader } from './relationship-rules'
import { enforceBulkMutationGate, resolveGuardForTable } from './row-level-guard'
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
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  // Effective roles, not a bare role: the guarded branch below evaluates
  // `guard.effectiveRoles`, while this unguarded branch used a bare `userRole`
  // that no `group:<name>` permission entry could ever match. A refusal is the
  // 404 the single-record delete answers (S1): never a 403 confirming the
  // table holds records the caller may not remove.
  if (
    !guard &&
    !hasDeletePermissionForRoles(table, buildEffectiveRoles(userRole, userGroups), app)
  ) {
    return notFound(c)
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

  await runOnRequest(
    c,
    batchDeleteWithSideEffects({ session, tableName, app, ids, permanent: false })
  )

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
 * `write` entry stays writable to a caller who may read it.
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

  const unknownError = refuseUnknownBulkKeys(app, tableName, data, c)
  if (unknownError) return { refusal: unknownError }

  const { allowedData, forbiddenFields } = filterAllowedFieldsWithRole(
    app,
    tableName,
    { role: userRole, groups: getTableContext(c).userGroups },
    data
  )
  // S1 anti-enumeration: a field the role cannot write refuses the whole
  // request with 404 rather than dropping the key, so the field-permission
  // boundary stays undiscoverable — the contract the JSON verb pins.
  const forbiddenError = validateUpdateForbiddenFields(forbiddenFields, c)
  if (forbiddenError) return { refusal: forbiddenError }

  const valueError = await validateUpdateFieldValues({
    c,
    app,
    tableName,
    userRole,
    fields: allowedData,
  })
  if (valueError) return { refusal: formatValidationError(valueError, c) }

  // `rich-text` columns are HTML-sanitized last, on the map that survived the
  // gates above — the same shared rule and the same position the single-record
  // verb runs it in (record-write-handlers.ts:538). Unlike its siblings this
  // one TRANSFORMS the write rather than refusing it, so the sanitized map is
  // what this helper returns and therefore what reaches every targeted row:
  // computing it without feeding it forward would leave the raw markup on the
  // column while every gate reported success.
  return {
    fields: await sanitizeUpdateRichTextFields(
      app,
      tableName,
      {
        role: userRole,
        groups: getTableContext(c).userGroups,
        signedOut: isGuestSession(getTableContext(c).session.userId),
      },
      allowedData
    ),
  }
}

/**
 * Refuse a bulk-update key that names no field of the table.
 *
 * `_data` is written column by column, and a key naming nothing was dropped on
 * the way while the request still answered success — so the single-record
 * form's `<field>__clear` marker, posted here, reported a clear that never
 * happened. The records API refuses an unknown field with this same 400; a bulk
 * clear is stated as JSON `null`.
 */
function refuseUnknownBulkKeys(
  app: App,
  tableName: string,
  data: Readonly<Record<string, unknown>>,
  c: Context
): Response | undefined {
  const known = new Set(
    (app.tables?.find((t) => t.name === tableName)?.fields ?? []).map((f) => f.name)
  )
  if (Object.keys(data).every((key) => known.has(key))) return undefined
  return c.json(
    {
      success: false,
      message: 'A submitted field is not recognised for this resource',
      code: 'VALIDATION_ERROR',
    },
    400
  )
}

/**
 * The bulk-update REQUEST gates, in order: the table-level update permission
 * (403), the empty-target check (400), the per-field and per-value rules, then
 * the Z-3 row-level gate over every targeted id (404) — which reads each row as
 * it will be written, so it runs on the resolved field map. Returns the refusal
 * `Response`, or the field map to write.
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
  /** Group names the caller belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly ids: readonly string[]
  /** The parsed `_data` blob. */
  readonly data: Record<string, unknown>
}): Promise<{ readonly refusal: Response } | { readonly fields: Record<string, unknown> }> {
  const { c, app, session, tableName, userRole, userGroups, ids, data } = input

  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  // Effective roles, not a bare role — same contract, and the same 404, as the
  // bulk-delete gate above.
  if (
    !guard &&
    !hasUpdatePermissionForRoles(table, buildEffectiveRoles(userRole, userGroups), app)
  ) {
    return { refusal: notFound(c) }
  }

  if (ids.length === 0) {
    const refusal = c.json(
      { success: false, message: 'No records specified', code: 'BAD_REQUEST' },
      400
    )
    return { refusal }
  }

  // Per-FIELD and per-VALUE rules, after the table-level gate so an
  // unauthorized caller is refused before learning anything about the payload.
  const resolved = await resolveBulkUpdateFields({ c, app, tableName, userRole, data })
  if ('refusal' in resolved || !guard) return resolved

  // Z-3: row-level scoping — every id must individually satisfy the read and
  // write predicates, each row checked as it stands AND as it will be written
  // (the resolved field map). Atomic-fail on any miss.
  const rowError = await enforceBulkMutationGate({
    c,
    table,
    session,
    tableName,
    ids,
    guard,
    op: 'write',
    changes: new Map(ids.map((id) => [String(id), resolved.fields])),
  })
  return rowError ? { refusal: rowError } : resolved
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
  const { session, tableName, userRole, userGroups } = getTableContext(c)

  const body = await c.req.parseBody()
  const ids = parseJsonField<readonly string[]>(body['_ids'], [])
  const data = parseJsonField<Record<string, unknown>>(body['_data'], {})
  const redirectPath = typeof body['_redirect'] === 'string' ? body['_redirect'] : undefined

  const resolved = await resolveBulkUpdateGates({
    c,
    app,
    session,
    tableName,
    userRole,
    userGroups,
    ids,
    data,
  })
  if ('refusal' in resolved) return resolved.refusal

  const recordsData = ids.map((id) => ({ id, fields: resolved.fields }))

  // The batch update the records API runs, side effects included: a column the
  // user wrote by hand is no longer reported as a failed computed fallback.
  await runOnRequest(
    c,
    batchUpdateWithSideEffects({
      ...{ session, tableName, app, linkReader: getLinkReader(c) },
      records: recordsData,
      returnRecords: false,
    })
  )

  // The path arrives in the request body, so it is only honoured once proven
  // same-origin — otherwise it is an open redirect off this site.
  if (isSafeRedirectPath(redirectPath)) {
    return c.redirect(redirectPath, 302)
  }

  return c.json({ success: true }, 200)
}
