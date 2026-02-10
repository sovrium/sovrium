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
 * Validate table schema including fields, permissions, views, and roles.
 * Orchestrates all validation functions from extracted modules.
 *
 * IMPORTANT: This function uses a generic type parameter instead of an inline type annotation
 * to avoid narrowing the Table type when used with Schema.filter(). Inline type annotations
 * would cause TypeScript to narrow the schema's output type, removing properties like `id`,
 * `required`, etc. from fields — cascading errors to all downstream consumers.
 *
 * @param table - Table to validate (type inferred from Schema.filter)
 * @returns Validation error object if invalid, true if valid
 */
type ValidationError = { readonly message: string; readonly path: ReadonlyArray<string> }

const validateStructure = (
  table: Record<string, unknown>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  if (table.primaryKey) {
    const primaryKey = table.primaryKey as {
      readonly type: string
      readonly fields?: ReadonlyArray<string>
    }
    const primaryKeyError = validatePrimaryKey(primaryKey, fieldNames)
    if (primaryKeyError) return primaryKeyError
  }

  const indexes = table.indexes as
    | ReadonlyArray<{ readonly name: string; readonly fields: ReadonlyArray<string> }>
    | undefined
  if (indexes && indexes.length > 0) {
    const indexError = validateIndexes(indexes, fieldNames)
    if (indexError) return indexError
  }

  return undefined
}

const validateAccessAndViews = (
  table: Record<string, unknown>,
  fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly formula?: string
  }>,
  fieldNames: ReadonlySet<string>
): ValidationError | undefined => {
  if (table.permissions) {
    const permissions = table.permissions as {
      readonly fields?: ReadonlyArray<{ readonly field: string }>
    }
    const permissionsError = validateTablePermissions(permissions, fields, fieldNames)
    if (permissionsError) return permissionsError
  }

  const views = table.views as
    | ReadonlyArray<{ readonly id: string | number; readonly isDefault?: boolean }>
    | undefined
  if (views && views.length > 0) {
    const viewsError = validateViews(views, fields, fieldNames)
    if (viewsError) return viewsError
  }

  return undefined
}

const validateTableSchema = (table: Record<string, unknown>): ValidationError | true => {
  const fields = table.fields as ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly formula?: string
  }>
  const fieldNames = new Set(fields.map((field) => field.name))

  // Validate formula fields (always required)
  const formulaError = validateFormulaFields(fields)
  if (formulaError) return formulaError

  // Validate structural constraints (primaryKey, indexes)
  const structureError = validateStructure(table, fieldNames)
  if (structureError) return structureError

  // Validate access control and views (permissions, views)
  const accessError = validateAccessAndViews(table, fields, fieldNames)
  if (accessError) return accessError

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
   * Configures application-layer permission enforcement.
   * Supports public, authenticated, and role-based access control.
   *
   * @example Role-based permissions
   * ```typescript
   * permissions: {
   *   read: 'all',
   *   comment: 'authenticated',
   *   create: ['admin', 'editor'],
   *   update: ['admin', 'editor'],
   *   delete: ['admin'],
   * }
   * ```
   *
   * @see TablePermissionsSchema for full configuration options
   */
  permissions: Schema.optional(TablePermissionsSchema),

  /**
   * Allow destructive operations (column drops, table drops) without confirmation.
   *
   * When set to true, migrations are allowed to drop columns that exist in the database
   * but are not present in the schema. This can result in data loss.
   *
   * When false or undefined, migrations will throw an error if a column needs to be dropped,
   * requiring explicit confirmation to proceed with data loss operations.
   *
   * @default false
   *
   * @example Allow column drops
   * ```typescript
   * {
   *   name: 'users',
   *   fields: [{ id: 1, name: 'email', type: 'email' }],
   *   allowDestructive: true // Allows dropping columns not in schema
   * }
   * ```
   */
  allowDestructive: Schema.optional(Schema.Boolean),
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
