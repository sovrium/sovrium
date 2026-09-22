/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Table permission cross-validation.
 *
 * Table `permissions` arrays — both table-level operations (`read`, `create`,
 * `update`, `delete`, etc.) and field-level entries (`fields[].read` /
 * `fields[].write`) — may reference Sovrium groups with the `group:<name>`
 * prefix (e.g. `create: ['admin', 'group:marketing']`). Every referenced
 * group must be declared in `app.auth.groups` — an undefined group reference
 * is a configuration error.
 *
 * Extracted into a standalone module (mirroring `validateAllPageAccessGroups`)
 * so the `AppSchema` `Schema.filter` chain stays a thin one-liner — inlining
 * a multi-statement validator pushes TypeScript's inference depth over the
 * limit and collapses the derived `App` type to `never`.
 *
 * **Not the same rule as `table-permission-fields-validation.ts`**, its sibling
 * in this directory. The two were a single letter apart before the layout
 * programme renamed them — this file was named `table-permission-validation`
 * at the time, that one `table-permissions-validation`, in different
 * directories — which is why both now say what they are. That one checks ONE
 * table's `permissions.fields[]` entries
 * against that table's own field names — duplicates and unknown fields — and
 * needs no `app`; this one resolves `group:<name>` references across EVERY
 * table against `app.auth.groups`. Neither calls the other, and their call
 * sites differ accordingly: that module is reached from `tables/table.ts`
 * (per-table refinement), this one from `models/app/index.ts` (app-wide
 * refinement).
 */

import { extractGroupNames } from '../auth/groups/group-reference'

/** Table-level permission operations whose arrays may reference groups. */
const PERMISSION_OPS = ['read', 'comment', 'create', 'update', 'delete'] as const

/** Minimal shape needed to validate table permission group references. */
interface AppForTablePermissionValidation {
  readonly auth?: { readonly groups?: ReadonlyArray<{ readonly name: string }> }
  readonly tables?: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>
}

/** A permission value referenced under a labelled location (for error text). */
interface PermissionRef {
  readonly location: string
  readonly value: unknown
}

/**
 * Collect every (location, value) permission array on a table — table-level
 * operations plus field-level read/write entries.
 */
function collectPermissionRefs(tableName: string, permissions: unknown): readonly PermissionRef[] {
  if (!permissions || typeof permissions !== 'object') return []
  const perms = permissions as Readonly<Record<string, unknown>>

  const tableLevel = PERMISSION_OPS.map((op) => ({
    location: `Table '${tableName}' permissions.${op}`,
    value: perms[op],
  }))

  const fields = Array.isArray(perms['fields'])
    ? (perms['fields'] as readonly unknown[]).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const fieldPerm = entry as Readonly<Record<string, unknown>>
        const fieldName = String(fieldPerm['field'] ?? '?')
        return [
          {
            location: `Table '${tableName}' permissions.fields '${fieldName}'.read`,
            value: fieldPerm['read'],
          },
          {
            location: `Table '${tableName}' permissions.fields '${fieldName}'.write`,
            value: fieldPerm['write'],
          },
        ]
      })
    : []

  return [...tableLevel, ...fields]
}

/**
 * Validate that every `group:<name>` reference in a table `permissions` array
 * (table-level or field-level) points to a group declared in
 * `app.auth.groups`.
 *
 * Returns `true` when all references are valid, or an error message string
 * naming the first offending location and group.
 */
export const validateAllTablePermissionGroups = (
  app: AppForTablePermissionValidation
): string | true => {
  if (!app.tables) return true

  const definedGroups = new Set(app.auth?.groups?.map((group) => group.name) ?? [])

  const error = app.tables
    .flatMap((table) => collectPermissionRefs(table.name, table.permissions))
    .flatMap((ref) =>
      extractGroupNames(ref.value)
        .filter((groupName) => !definedGroups.has(groupName))
        .map(
          (groupName) =>
            `${ref.location} references undefined group 'group:${groupName}'. ` +
            `Declare it in auth.groups.`
        )
    )
    .at(0)

  return error ?? true
}
