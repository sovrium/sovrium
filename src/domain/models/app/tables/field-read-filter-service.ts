/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  DENY_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  type PermissionCaller,
} from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/tables/permissions'

/**
 * System fields that are always preserved in record filtering
 * These include authorship metadata and timestamps
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
 * Check if field name is a system field
 */
function isSystemField(fieldName: string): boolean {
  return SYSTEM_FIELDS.has(fieldName)
}

/**
 * Check if field is sensitive type (email, phone, currency)
 */
function isSensitiveFieldType(fieldType: string): boolean {
  const sensitiveTypes = new Set(['email', 'phone-number', 'currency'])
  return sensitiveTypes.has(fieldType)
}

/**
 * Check if field should be excluded for viewer role
 */
function shouldExcludeForViewer(fieldName: string, fieldType: string): boolean {
  const allowedFieldTypes = new Set(['single-line-text'])
  const allowedFieldNames = new Set(['name', 'title'])

  // Exclude sensitive field types
  if (isSensitiveFieldType(fieldType)) {
    return true
  }

  // Only allow specific field names or types
  if (!allowedFieldNames.has(fieldName) && !allowedFieldTypes.has(fieldType)) {
    return true
  }

  // For single-line-text, only allow if it's a name/title field
  if (fieldType === 'single-line-text' && !allowedFieldNames.has(fieldName)) {
    return true
  }

  return false
}

/**
 * Structural shape of a table needed to evaluate the built-in default rules.
 */
type FieldBearingTable = {
  readonly fields: readonly { readonly name: string; readonly type: string }[]
}

/**
 * Check if field should be excluded based on the built-in default read rules.
 * Sensitive fields (like salary) are restricted for non-admin roles.
 *
 * These rules apply ONLY when the table declares no `permissions.fields` — an
 * explicit grant always wins (see {@link isFieldReadableByRole}).
 *
 * Superuser handling lives in {@link isFieldReadableByRole}, which short-circuits
 * on `isAdminEquivalent` before reaching here. The rules below key off the
 * built-in `viewer` / `member` role names and are inert for every other role.
 */
function isFieldExcludedByDefaultRules(
  fieldName: string,
  userRole: string,
  table: FieldBearingTable | undefined
): boolean {
  // Find field definition. An unknown field is never excluded here — field
  // existence is validated separately by the callers that care about it.
  const field = table?.fields.find((f) => f.name === fieldName)
  if (!field) return false

  // Viewer role: most restrictive access
  if (userRole === 'viewer') {
    return shouldExcludeForViewer(fieldName, field.type)
  }

  // Member role: restrict sensitive financial data
  if (userRole === 'member') {
    return fieldName === 'salary' && field.type === 'currency'
  }

  return false
}

/**
 * Canonical predicate: may `userRole` READ `fieldName` on `tableName`?
 *
 * This is the single source of truth for field-level read access. Every surface
 * that exposes a field's values — the record response itself, and the query
 * parameters that can be used to infer them (`groupBy`, `aggregate`) — must
 * agree, or an unreadable field becomes an oracle: a caller who cannot see
 * `notes` can still enumerate its distinct values via `?groupBy=notes`.
 *
 * Precedence (mirrors {@link filterReadableFields}, which is built on it):
 * 1. Admin-equivalent roles (the app's resolved top role + built-in `admin`)
 *    bypass every field-level read restriction.
 * 2. System fields (id, timestamps, authorship metadata) are always readable.
 * 3. When the table declares `permissions.fields`, an entry carrying a `read`
 *    decides; a missing entry (or one without `read`) inherits the table-level
 *    permission and is readable.
 * 4. Otherwise the built-in default rules apply.
 * 5. A field absent from `table.fields` is readable — existence is a separate
 *    concern, validated by the callers that need a 400.
 */
export function isFieldReadableByRole(
  app: App,
  tableName: string,
  userRole: string,
  fieldName: string
): boolean {
  return isFieldReadableByCaller(app, tableName, { role: userRole }, fieldName)
}

/**
 * The group-aware form of {@link isFieldReadableByRole}, and the one the
 * composed read plan uses.
 *
 * WHY A SEPARATE ENTRY POINT: a field grant may name a group
 * (`read: ['group:finance']`), and `evaluatePermission` matches such an entry
 * against `caller.groups` — NOT against the role string. The role-only form
 * therefore cannot satisfy a group grant at all, which made every
 * `group:`-scoped field grant inert on the REST record read.
 *
 * The realtime transport hid that: it evaluated a caller's `effectiveRoles`
 * list — which carries `group:<name>` entries as though they were roles —
 * through `hasPermission`'s literal `Array.includes`, so a group entry matched
 * by string equality. Two surfaces, two different mechanisms, one of them
 * accidental. Consolidating on the ROLE-only predicate would have silently
 * dropped the realtime behaviour; consolidating on the literal-include would
 * have carried the accident into the REST path. This carries the caller instead,
 * so both surfaces get the ONE mechanism `evaluatePermission` documents.
 *
 * Precedence is otherwise identical to {@link isFieldReadableByRole}.
 */
export function isFieldReadableByCaller(
  app: App,
  tableName: string,
  caller: PermissionCaller,
  fieldName: string
): boolean {
  const userRole = caller.role ?? ''
  // Admin-equivalent roles (the app's resolved top role + built-in `admin`)
  // bypass every field-level read restriction — the canonical superuser
  // predicate. Without this, a field grant that names only a custom top role
  // (e.g. Partner's `auteur` read: ['engineer']) strips the field from the
  // built-in-admin engineer stand-in too, hiding it from the very role that
  // should see it. Mirrors the table-level `evaluateFieldPermissions` admin
  // override.
  if (isAdminEquivalent(userRole, app)) return true

  // Always readable: system fields (including authorship metadata). These are
  // transformed by record-transformer into root-level camelCase properties.
  if (isSystemField(fieldName)) return true

  const table = app.tables?.find((t) => t.name === tableName)

  // An explicit `permissions.fields` declaration replaces the default rules.
  if (table?.permissions?.fields) {
    const fieldPermission = table.permissions.fields.find((fp) => fp.field === fieldName)

    // No specific read permission for this field: inherits table permission.
    if (!fieldPermission?.read) return true

    return hasFieldReadPermission(fieldPermission.read, caller)
  }

  return !isFieldExcludedByDefaultRules(fieldName, userRole, table)
}

/**
 * Filter fields from a record based on user's read permissions
 *
 * This implements Better Auth layer field read filtering.
 * Returns a record with only fields the user has permission to read.
 *
 * @param params - Configuration object
 * @param params.app - Application configuration
 * @param params.tableName - Name of the table
 * @param params.userRole - User's role
 * @param params.record - Record object to filter
 * @returns Record with only readable fields
 */
export function filterReadableFields<T extends Record<string, unknown>>(
  params: Readonly<{
    app: App
    tableName: string
    userRole: string
    record: T
  }>
): Readonly<Record<string, unknown>> {
  const { app, tableName, userRole, record } = params

  // One predicate, applied per field. Keeping this in step with the query-side
  // validators is the point: a field the response strips must not remain
  // queryable, and a field the response returns must remain queryable.
  return Object.keys(record).reduce<Record<string, unknown>>((acc, fieldName) => {
    if (!isFieldReadableByRole(app, tableName, userRole, fieldName)) {
      return acc // Omit the field from the response
    }
    return { ...acc, [fieldName]: record[fieldName] }
  }, {})
}

/**
 * Check if user's role has read permission.
 *
 * No admin override here: `isFieldReadableByRole` already short-circuits on
 * `isAdminEquivalent` above, which is broader than the built-in `admin` role.
 */
function hasFieldReadPermission(permission: TablePermission, caller: PermissionCaller): boolean {
  return permits(
    evaluatePermission(permission, caller, {
      whenUndeclared: DENY_WHEN_UNDECLARED,
      adminOverride: 'no-admin-override',
    })
  )
}
