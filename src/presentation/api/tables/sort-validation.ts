/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * System fields that exist in every table but are not in `app.tables[].fields`.
 *
 * Must stay in step with `SYSTEM_FIELDS` in
 * `domain/validators/field-read-filter.ts`, and it must actually be consulted:
 * otherwise a sort on any system column falls through to the
 * "not found in table.fields" branch below and is rejected — `?sort=created_by`
 * would return 400 for every non-admin role.
 */
const SYSTEM_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_by',
  'deleted_at',
])

/**
 * Check if user can read a field (for sorting validation)
 */
export function canUserReadField(
  app: App,
  tableName: string,
  fieldName: string,
  caller: Readonly<{ role: string; groups: readonly string[] }>
): boolean {
  const userRole = caller.role
  // System columns are readable by any role that can read the table at all. They
  // are not declared in `table.fields`, so they must be admitted before the
  // lookup below rejects them as unknown.
  if (SYSTEM_FIELDS.has(fieldName)) {
    return true
  }

  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields?.find((f) => f.name === fieldName)

  // Unknown field: rejected for every role, the admin included. Deliberate — it
  // keeps `?sort=<garbage>` from reaching SQL generation.
  if (!field) {
    return false
  }

  // The app's resolved TOP role is admin-EQUIVALENT and must behave like the
  // built-in `admin`. A literal `userRole === 'admin'` denied a custom top-tier
  // role (e.g. an `engineer` at the highest level) the sort access it already has
  // on the response-filter path — see the warning on `isAdminEquivalent` in
  // `domain/models/app/auth/roles`.
  if (isAdminEquivalent(userRole, app)) {
    return true
  }

  // The records response's own field read predicate — field grants, a grant
  // naming one of the caller's groups and the built-in role defaults
  // included: a caller sorts by exactly the fields they may read. A field the
  // caller may not read is not sorted on — an order by a hidden value
  // discloses it row by row.
  return isFieldReadableByCaller(app, tableName, caller, fieldName)
}

/**
 * Validate sort parameter - check user has permission to sort by requested fields
 */
export function validateSortPermission(config: {
  readonly sort: string | undefined
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups: readonly string[]
  readonly c: Context
}) {
  const { sort, app, tableName, userRole, userGroups, c } = config
  const caller = { role: userRole, groups: userGroups }

  if (!sort) return undefined

  // Parse sort parameter (format: "field:dir" or "field1:dir1,field2:dir2")
  const sortFields = sort
    .split(',')
    .map((s) => s.split(':')[0])
    .filter((field): field is string => field !== undefined && field !== '')

  // S1 anti-enumeration: a field the table does not have and a field the
  // caller may not read get the same 404, the one a filter on either gets —
  // a 400 for the first would tell the two apart (`canUserReadField` refuses
  // an unknown name before it can reach SQL generation).
  const refused = sortFields.find((field) => !canUserReadField(app, tableName, field, caller))
  return refused === undefined ? undefined : notFound(c)
}
