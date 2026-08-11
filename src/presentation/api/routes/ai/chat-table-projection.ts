/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat — shared `app.tables[]` projection.
 *
 * The chat context builder, the mutation flow, and the query flow each need
 * the app's `tables[]` reduced to the minimal `{ name, fields, permissions? }`
 * shape their domain helpers consume. The three projections were near-identical
 * copies that drifted only in whether the field's `required` flag is forwarded
 * and whether a `pageContext.allowedTables` allow-list narrows the table set.
 *
 * This module is the single source of truth: {@link projectAppTables} carries
 * both behaviours behind options so a change to the field-metadata projection
 * is made once.
 */

import {
  DENY_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  toPermissionValue,
} from '@/domain/models/shared/permission-evaluation'
import type { App } from '@/domain/models/app'

/** A field projected onto the minimal shape every chat parser/builder reads. */
export interface ProjectedField {
  readonly name: string
  readonly type: string
  /** Predefined option values for single-select / multi-select fields. */
  readonly options?: ReadonlyArray<string>
  /** `required` flag — forwarded only when {@link ProjectTablesOptions.includeRequired}. */
  readonly required?: boolean
}

/** A table projected onto the minimal shape, carrying its raw permissions block. */
export interface ProjectedTable {
  readonly name: string
  readonly fields: ReadonlyArray<ProjectedField>
  /** The table's (untyped) permissions block, forwarded verbatim for RBAC checks. */
  readonly permissions?: unknown
}

/** Options controlling the optional facets of the projection. */
export interface ProjectTablesOptions {
  /**
   * Forward each field's `required` flag. The mutation flow needs it for
   * create-payload validation; the context builder and query flow do not.
   */
  readonly includeRequired?: boolean
  /**
   * When present, only tables whose name appears in the allow-list are kept —
   * the page-scope narrowing applied for `pageContext.allowedTables`
   *.
   */
  readonly allowedTables?: ReadonlyArray<string>
}

/**
 * The structural shape of an `app.tables[].fields[]` entry this projection
 * reads. Declared minimally (rather than indexed off `App`) because the schema
 * field array is a heterogeneous union with no single indexable element type.
 */
interface RawField {
  readonly name: string
  readonly type: string
  readonly options?: unknown
  readonly required?: unknown
}

/** Project one field onto {@link ProjectedField}, honouring `includeRequired`. */
const projectField = (field: RawField, includeRequired: boolean): ProjectedField => ({
  name: field.name,
  type: field.type,
  ...(Array.isArray(field.options) ? { options: field.options as ReadonlyArray<string> } : {}),
  ...(includeRequired && typeof field.required === 'boolean' ? { required: field.required } : {}),
})

/**
 * Project the app's `tables[]` onto the minimal {@link ProjectedTable} shape
 * the chat context builder and the mutation/query parsers consume.
 *
 * The `permissions` block and field `options` are always forwarded; the field
 * `required` flag and the `allowedTables` filter are opt-in via
 * {@link ProjectTablesOptions}.
 */
export const projectAppTables = (
  app: App | undefined,
  options: ProjectTablesOptions = {}
): ReadonlyArray<ProjectedTable> => {
  const { includeRequired = false, allowedTables } = options
  return (app?.tables ?? [])
    .filter((table) => allowedTables === undefined || allowedTables.includes(table.name))
    .map((table) => ({
      name: table.name,
      fields: table.fields.map((field) => projectField(field, includeRequired)),
      ...(table.permissions !== undefined && { permissions: table.permissions }),
    }))
}

/** A field's (untyped) raw field-level permission entry. */
interface RawFieldPermission {
  readonly field: string
  readonly read?: unknown
}

/**
 * Compute the column names the acting role may READ for a table, applying
 * field-level read restrictions (declared at the table level via
 * `permissions.fields[]`). A column with no field-perm entry inherits the
 * table-level read permission (gated by the caller) and is therefore readable;
 * a column with a `read` restriction is readable only when the role passes
 * (admin override applies, mirroring `evaluateFieldPermissions`). Drives the
 * AI structured-query tool's column enums and result-row projection
 *.
 */
export const readableColumnsForRole = (
  fields: ReadonlyArray<ProjectedField>,
  permissions: unknown,
  userRole: string
): ReadonlyArray<string> => {
  const fieldPerms = (permissions as { fields?: ReadonlyArray<RawFieldPermission> } | undefined)
    ?.fields
  const restricted = new Map<string, unknown>(
    (fieldPerms ?? [])
      .filter((perm) => perm.read !== undefined)
      .map((perm) => [perm.field, perm.read])
  )
  return fields
    .filter((field) => {
      // A field with no `read` entry carries no restriction and stays readable;
      // only a declared entry is put to the ladder. A malformed entry normalises
      // to undeclared and is denied — a restriction nobody can parse restricts.
      if (!restricted.has(field.name)) return true
      return permits(
        evaluatePermission(
          toPermissionValue(restricted.get(field.name)),
          { role: userRole },
          {
            whenUndeclared: DENY_WHEN_UNDECLARED,
            adminOverride: 'admin-outranks-everything',
          }
        )
      )
    })
    .map((field) => field.name)
}
