/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableIdSchema } from '@/domain/models/app/common/branded-ids'
import { CheckConstraintsSchema } from './check-constraints'
import { FieldsSchema } from './fields'
import { ForeignKeySchema } from './foreign-keys'
import { IndexesSchema } from './indexes'
import { NameSchema } from './name'
import { TablePermissionsSchema } from './permissions'
import { PrimaryKeySchema } from './primary-key'
import { SPECIAL_FIELDS, validateFormulaFields } from './table-formula-validation'
import { validateIndexes } from './table-indexes-validation'
import { validateTablePermissions } from './table-permissions-validation'
import { validatePrimaryKey } from './table-primary-key-validation'
import { validateViews } from './table-views-validation'
import { UniqueConstraintsSchema } from './unique-constraints'
import { ViewSchema } from './views'

// Re-export SPECIAL_FIELDS for external use
export { SPECIAL_FIELDS }

/**
 * Table Schema
 *
 * Defines a single database table entity with its structure, fields, and constraints.
 * Each table represents a distinct entity (e.g., users, products, orders) with fields
 * that define the data schema. Tables support primary keys, unique constraints, and
 * indexes for efficient data access and integrity.
 *
 * @example
 * ```typescript
 * const userTable = {
 *   id: 1,
 *   name: 'users',
 *   fields: [
 *     { id: 1, name: 'email', type: 'email', required: true },
 *     { id: 2, name: 'name', type: 'single-line-text', required: true }
 *   ],
 *   primaryKey: { fields: ['id'] },
 *   uniqueConstraints: [{ fields: ['email'] }]
 * }
 * ```
 *
 * @see docs/specifications/roadmap/tables.md for full specification
 */

/**
 * Run all structural validations (formula fields, primary keys, indexes).
 *
 * @param table - Table to validate
 * @param fieldNames - Set of valid field names
 * @returns Validation error object if invalid, undefined if valid
 */
const validateTableStructure = (
  table: {
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly formula?: string
    }>
    readonly primaryKey?: { readonly type: string; readonly fields?: ReadonlyArray<string> }
    readonly indexes?: ReadonlyArray<{
      readonly name: string
      readonly fields: ReadonlyArray<string>
    }>
  },
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Validate formula fields
  const formulaError = validateFormulaFields(table.fields)
  if (formulaError) return formulaError

  // Validate primary key if present
  if (table.primaryKey) {
    const primaryKeyError = validatePrimaryKey(table.primaryKey, fieldNames)
    if (primaryKeyError) return primaryKeyError
  }

  // Validate indexes if present
  if (table.indexes && table.indexes.length > 0) {
    const indexError = validateIndexes(table.indexes, fieldNames)
    if (indexError) return indexError
  }

  return undefined
}

/**
 * Run all access control validations (permissions and views).
 *
 * @param table - Table to validate
 * @param fieldNames - Set of valid field names
 * @returns Validation error object if invalid, undefined if valid
 */
const validateTableAccessControl = (
  table: {
    readonly fields: ReadonlyArray<{
      readonly name: string
      readonly type: string
      readonly formula?: string
    }>
    readonly views?: ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>
    readonly permissions?: {
      readonly organizationScoped?: boolean
      readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly create?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly update?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly delete?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly fields?: ReadonlyArray<{
        readonly field: string
        readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
        readonly write?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      }>
      readonly records?: ReadonlyArray<{ readonly action: string; readonly condition: string }>
    }
  },
  fieldNames: ReadonlySet<string>
): { readonly message: string; readonly path: ReadonlyArray<string> } | undefined => {
  // Validate permissions if present
  if (table.permissions) {
    const permissionsError = validateTablePermissions(table.permissions, table.fields, fieldNames)
    if (permissionsError) return permissionsError
  }

  // Validate views if present
  if (table.views && table.views.length > 0) {
    const viewsError = validateViews(table.views, table.fields, fieldNames)
    if (viewsError) return viewsError
  }

  return undefined
}

/**
 * Validate table schema including fields, permissions, views, and roles.
 * Orchestrates all validation functions from extracted modules.
 *
 * @param table - Table to validate
 * @returns Validation error object if invalid, true if valid
 */
const validateTableSchema = (table: {
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly formula?: string
  }>
  readonly primaryKey?: { readonly type: string; readonly fields?: ReadonlyArray<string> }
  readonly indexes?: ReadonlyArray<{
    readonly name: string
    readonly fields: ReadonlyArray<string>
  }>
  readonly views?: ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>
  readonly permissions?: {
    readonly organizationScoped?: boolean
    readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly create?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly update?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly delete?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    readonly fields?: ReadonlyArray<{
      readonly field: string
      readonly read?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
      readonly write?: { readonly type: string; readonly roles?: ReadonlyArray<string> }
    }>
    readonly records?: ReadonlyArray<{ readonly action: string; readonly condition: string }>
  }
}): { readonly message: string; readonly path: ReadonlyArray<string> } | true => {
  const fieldNames = new Set(table.fields.map((field) => field.name))

  // Validate structural aspects (fields, constraints, indexes)
  const structureError = validateTableStructure(table, fieldNames)
  if (structureError) return structureError

  // Validate access control (permissions, views)
  const accessControlError = validateTableAccessControl(table, fieldNames)
  if (accessControlError) return accessControlError

  return true
}

export const TableSchema = Schema.Struct({
  id: Schema.optional(TableIdSchema),
  name: NameSchema,
  fields: FieldsSchema,
  primaryKey: Schema.optional(PrimaryKeySchema),
  uniqueConstraints: Schema.optional(UniqueConstraintsSchema),
  indexes: Schema.optional(IndexesSchema),
  views: Schema.optional(Schema.Array(ViewSchema)),

  /**
   * Composite foreign key constraints.
   *
   * Used for multi-column foreign keys where multiple fields together reference
   * a composite primary key in another table. Single-column foreign keys are
   * automatically created from relationship fields.
   *
   * @example Composite foreign key
   * ```typescript
   * foreignKeys: [{
   *   name: 'fk_permissions_tenant_user',
   *   fields: ['tenant_id', 'user_id'],
   *   referencedTable: 'tenant_users',
   *   referencedFields: ['tenant_id', 'user_id']
   * }]
   * ```
   *
   * @see ForeignKeySchema for full configuration options
   */
  foreignKeys: Schema.optional(Schema.Array(ForeignKeySchema)),

  /**
   * Custom CHECK constraints for complex business rules.
   *
   * Used to enforce conditional validation at the database level beyond
   * simple field-level constraints. Useful for cross-field validation,
   * conditional requirements, and complex business logic.
   *
   * @example Conditional requirement
   * ```typescript
   * constraints: [{
   *   name: 'chk_active_members_have_email',
   *   check: '(is_active = false) OR (email IS NOT NULL)'
   * }]
   * ```
   *
   * @example Range validation
   * ```typescript
   * constraints: [{
   *   name: 'chk_end_after_start',
   *   check: 'end_date > start_date'
   * }]
   * ```
   *
   * @see CheckConstraintsSchema for full configuration options
   */
  constraints: Schema.optional(CheckConstraintsSchema),

  /**
   * Table-level permissions (high-level RBAC abstraction).
   *
   * Automatically generates RLS policies based on permission configuration.
   * Supports public, authenticated, role-based, and owner-based access control.
   *
   * @example Role-based permissions
   * ```typescript
   * permissions: {
   *   read: { type: 'roles', roles: ['member'] },
   *   create: { type: 'roles', roles: ['admin'] },
   *   update: { type: 'authenticated' },
   *   delete: { type: 'roles', roles: ['admin'] },
   * }
   * ```
   *
   * @example Owner-based access
   * ```typescript
   * permissions: {
   *   read: { type: 'owner', field: 'user_id' },
   *   update: { type: 'owner', field: 'user_id' },
   *   delete: { type: 'owner', field: 'user_id' },
   * }
   * ```
   *
   * @see TablePermissionsSchema for full configuration options
   */
  permissions: Schema.optional(TablePermissionsSchema),
}).pipe(
  Schema.filter(validateTableSchema),
  Schema.annotations({
    title: 'Table',
    description:
      'A database table that defines the structure of an entity in your application. Contains fields, constraints, and indexes to organize and validate data.',
    examples: [
      {
        id: 1,
        name: 'users',
        fields: [
          { id: 1, name: 'email', type: 'email' as const, required: true },
          { id: 2, name: 'name', type: 'single-line-text' as const, required: true },
        ],
      },
      {
        id: 2,
        name: 'products',
        fields: [
          { id: 1, name: 'title', type: 'single-line-text' as const, required: true },
          {
            id: 2,
            name: 'price',
            type: 'currency' as const,
            required: true,
            currency: 'USD',
          },
          { id: 3, name: 'description', type: 'long-text' as const, required: false },
        ],
        primaryKey: { type: 'composite', fields: ['id'] },
      },
    ],
  })
)

export type Table = Schema.Schema.Type<typeof TableSchema>

// Re-export all table model schemas and types for convenient imports
export * from './check-constraints'
export * from './field-name'
export * from './field-types'
export * from './fields'
export * from './foreign-keys'
export * from './id'
export * from './indexes'
export * from './name'
export * from './permissions'
export * from './primary-key'
export * from './unique-constraints'
export * from './views'
