/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The gates a bulk create and an upsert pass before they write, shared by the
 * records API's batch and upsert routes and the CSV import's route — so an
 * import is judged row by row exactly as the batch call it replaces: the same
 * table and row-level grants, the same field write audiences, the same
 * readonly and per-value rules.
 */

import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  hasCreatePermissionForRoles,
  hasReadPermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { checkBatchFieldPermissions, validateBulkFieldValues } from './batch-permission-helpers'
import { forbiddenCreateResponse } from './response-helpers'
import { enforceBulkCreateGate, resolveGuardForTable } from './row-level-guard'
import { validateReadonlyFields, validateUpsertRequest } from './upsert-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

type Records = readonly { readonly fields: Record<string, unknown> }[]

/**
 * Resolve the create-authorisation gate for batch create. Returns the
 * guard context (when the table is row-level scoped) so callers can chain
 * the per-row predicate check, or `undefined` for non-row-level tables.
 *
 * PARITY WITH THE SINGLE-RECORD PATH IS THE CONTRACT, and it is a three-part
 * contract, and omitting any part is its own defect. `checkCreateGate` (`../record/record-write-handlers.ts`) is the
 * reference implementation:
 *
 *  1. INHERITANCE. `app.tables` is the resolution set. Without it a table
 *     declaring `permissions: { inherit: '<parent>' }` resolves as if it had no
 *     create rule at all, so an inherited admin-only grant read as UNRESTRICTED
 *     on the batch path while the single-record path refused — the same request,
 *     two verdicts.
 *  2. GROUP GRANTS. A bare `userRole` can never match a `group:<name>` entry,
 *     because the group overlay exists only in the effective-role set built by
 *     `buildEffectiveRoles`. Passing the raw role leaves every group grant
 *     silently inert here while it works on the single-record route.
 *  3. S1 ANTI-ENUMERATION. A caller who also lacks READ access gets 404, not
 *     403 — a 403 confirms the table exists to someone with no business knowing
 *     it does.
 *
 * Fixing (1) alone is the trap: it closes the inheritance hole and leaves the
 * group hole open, while looking like the finding is closed.
 */
async function resolveBatchCreateAuth(input: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** Group names the user belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
}): Promise<Response | undefined> {
  const { c, app, tableName, userRole, userGroups, session, records } = input
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  if (guard) {
    return enforceBulkCreateGate({
      c,
      table,
      guard,
      records: records.map((r) => r.fields),
    })
  }
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)
  if (!hasCreatePermissionForRoles(table, effectiveRoles, app)) {
    // S1 anti-enumeration, mirroring the single-record path: no read access
    // collapses the denial to 404 so the table's existence is not disclosed.
    if (!hasReadPermissionForRoles(table, effectiveRoles, app)) {
      return notFound(c)
    }
    return forbiddenCreateResponse(c)
  }
  return undefined
}

/**
 * Every gate a bulk create passes, in order: the table and row-level create
 * grant, the field write audiences, then the readonly and per-value rules. The
 * single-record route gets the per-value rules from `validateRecordCreation`;
 * a bulk route has to ask, or an undeclared `multi-select` option and a
 * relationship past `maxLinked` reach the database. Resolves the refusal, or
 * `undefined` when the create may proceed.
 */
export async function guardBatchCreate(
  c: Context,
  app: App,
  records: Records
): Promise<Response | undefined> {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  return (
    (await resolveBatchCreateAuth({ c, app, tableName, userRole, userGroups, session, records })) ??
    checkBatchFieldPermissions({ records, app, tableName, userRole, userGroups, c }) ??
    validateReadonlyFields(table, records, c) ??
    (await validateBulkFieldValues(c, app, records))
  )
}

/**
 * Every gate an upsert passes: a merge field the caller may not read is refused
 * first, `id` is never written, the readonly and per-value rules BEFORE the
 * permission checks, then the create and update grants and the required fields
 * (`validateUpsertRequest`), which strip the fields the caller may not write.
 *
 * The merge-field refusal is the one a filter on that field gets — `404`, the
 * table-missing body — and it comes before any lookup, so it reads the same
 * whether or not a row holds the value: matching on a field is reading it.
 */
export async function guardUpsert(
  c: Context,
  app: App,
  records: Records,
  fieldsToMergeOn: readonly string[]
): ReturnType<typeof validateUpsertRequest> {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const caller = { role: userRole, groups: userGroups }
  if (fieldsToMergeOn.some((field) => !isFieldReadableByCaller(app, tableName, caller, field))) {
    return { success: false, response: notFound(c) }
  }
  // `id` is always readonly, with an upsert-specific message.
  if (records.some((record) => 'id' in record.fields)) {
    const message = 'Cannot set readonly field: id'
    return {
      success: false,
      response: c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400),
    }
  }
  const fieldGuard =
    validateReadonlyFields(table, records, c) ?? (await validateBulkFieldValues(c, app, records))
  if (fieldGuard) return { success: false, response: fieldGuard }
  return validateUpsertRequest({
    ...{ c, app, tableName, userRole, userGroups, session },
    records,
    fieldsToMergeOn,
  })
}
