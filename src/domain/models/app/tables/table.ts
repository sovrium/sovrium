/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiAccessSchema } from '@/domain/models/shared/ai-access'
import { TableIdSchema } from '@/domain/types/branded-ids'
import { SPECIAL_FIELDS, validateFormulaFields } from '@/domain/validators/table-formula-validation'
import { validateIndexes } from '@/domain/validators/table-indexes-validation'
import { validateTablePermissions } from '@/domain/validators/table-permissions-validation'
import { validatePrimaryKey } from '@/domain/validators/table-primary-key-validation'
import { validateViews } from '@/domain/validators/table-views-validation'
import { CommentsConfigSchema } from './comments'
import { CheckConstraintsSchema } from './constraints'
import { FieldsSchema } from './fields'
import { ForeignKeySchema } from './foreign-keys'
import { IndexesSchema } from './indexes'
import { NameSchema } from './name'
import { TablePermissionsSchema } from './permissions'
import { PrimaryKeySchema } from './primary-key'
import { RowLevelPermissionsSchema } from './row-level-permissions'
import { ViewSchema } from './views'
import { WebhookSchema } from './webhooks'

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
 *   indexes: [{ name: 'idx_email', fields: ['email'], unique: true }]
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
  indexes: Schema.optional(IndexesSchema),

  /**
   * Table-level unique constraints declared as a sugar over indexes.
   *
   * Each entry produces a unique constraint over the listed fields. Single-
   * field entries fold into the same per-field unique constraint emitted by
   * `field.unique = true`; multi-field entries are realised as a unique
   * btree index. Schema-author syntax mirrors WordPress / Webflow CMS
   * conventions:
   *
   * ```yaml
   * tables:
   *   - name: posts
   *     fields:
   *       - { name: slug, type: single-line-text }
   *     unique:
   *       - fields: [slug]
   * ```
   *
   * Used by US-PAGES-ACCESS-PUBLISHING-002 (slug-management) — collection
   * pages rely on slug uniqueness to address records by URL segment.
   * Internally, the schema initializer normalizes top-level `unique` into
   * field-level `unique: true` (single-field) or `indexes` entries with
   * `unique: true` (composite), so existing constraint-sync and
   * index-sync handle migration without a new code path.
   */
  unique: Schema.optional(
    Schema.Array(
      Schema.Struct({
        fields: Schema.Array(Schema.String).pipe(
          Schema.minItems(1, { message: () => 'At least one field is required' })
        ),
      })
    ).pipe(
      Schema.annotations({
        title: 'Table Unique Constraints',
        description:
          'Top-level unique-constraint declarations. Each entry covers one or more fields.',
        examples: [[{ fields: ['slug'] }], [{ fields: ['tenant_id', 'slug'] }]],
      })
    )
  ),
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
   * Row-level permissions (Z-3 — defense-in-depth scoping).
   *
   * Server-side `when` predicates per CRUD operation. When present, every
   * record-returning API call (read/write/create/delete) appends the
   * predicate as a server-side filter. Unauthorized direct access returns
   * 404 (not 403) to prevent enumeration.
   *
   * Combined with `permissions` (role-based) for defense-in-depth: the
   * role gate runs first; the row-level predicate filters within the
   * permitted role's scope.
   *
   * @example Customers see only their own client's tickets
   * ```typescript
   * rowLevelPermissions: {
   *   read: { when: { field: 'client_id', operator: 'in',
   *     value: '$currentUser.assignments.clients' } },
   *   write: { when: { field: 'client_id', operator: 'in',
   *     value: '$currentUser.assignments.clients' } },
   * }
   * ```
   *
   * @see RowLevelPermissionsSchema for full configuration options
   */
  rowLevelPermissions: Schema.optional(RowLevelPermissionsSchema),

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

  /**
   * Permit hard-delete (force-delete) of records via the admin dashboard, bypassing soft-delete.
   *
   * Sovrium tables soft-delete by default (per `@docs/architecture/patterns/soft-delete-by-default.md`):
   * `DELETE /api/tables/:tableId/records/:recordId` sets `deleted_at` and `deleted_by`, leaving
   * the row recoverable via `/restore`. Some compliance scenarios (GDPR right-to-erasure) require
   * the row to physically vanish. Other tables (financial ledgers, audit-adjacent records) MUST
   * never permit hard-delete because downstream systems assume the row is permanent.
   *
   * This flag is the **app-author's per-table opt-in**. It gates the admin endpoint
   * `POST /api/admin/tables/:tableId/records/:recordId/force-delete`:
   *
   *   - When `allowForceDelete` is `true`, the endpoint accepts the request, hard-deletes
   *     the row, and emits a `record.force_deleted` audit event.
   *   - When `allowForceDelete` is `false` or undefined, the endpoint responds 404
   *     (per anti-enumeration rule) and **no audit event is emitted**. Operators MUST
   *     soft-delete instead.
   *
   * Per plan §12 Q4 (locked: per-table flag, default false): this is business intent,
   * not infrastructure config. HR may opt in to comply with GDPR; financial-ledger MUST NOT.
   *
   * @default false
   *
   * @example HR table opts in for GDPR compliance
   * ```typescript
   * {
   *   name: 'employees',
   *   fields: [{ id: 1, name: 'email', type: 'email' }],
   *   allowForceDelete: true,
   * }
   * ```
   *
   * @example Financial ledger forbids force-delete (default)
   * ```typescript
   * {
   *   name: 'transactions',
   *   fields: [{ id: 1, name: 'amount', type: 'currency' }],
   *   // allowForceDelete: false (default — admin force-delete returns 404)
   * }
   * ```
   *
   * @see plan §12 Q4 (locked decision)
   * @see action-catalog.ts (`record.force_deleted` action)
   */
  allowForceDelete: Schema.optional(Schema.Boolean),

  /**
   * Outgoing webhooks fired on record CRUD events (optional).
   *
   * Syntactic sugar over automations — each webhook expands to a record trigger
   * + webhook.send action internally. Webhook names must be unique within the table.
   */
  webhooks: Schema.optional(
    Schema.Array(WebhookSchema).pipe(
      Schema.annotations({
        title: 'Table Webhooks',
        description: 'Outgoing webhooks triggered on record create/update/delete events',
      })
    )
  ),

  /**
   * Comment system configuration for this table.
   *
   * Controls comment features like guest commenting and moderation.
   * Separate from permissions.comment (which controls who can comment).
   */
  comments: Schema.optional(CommentsConfigSchema),

  /**
   * AI/MCP exposure configuration.
   *
   * Declares this table as eligible for exposure via Sovrium's MCP server
   * (Model Context Protocol) so AI assistants like Claude can list, read,
   * create, update, or delete records (subject to RBAC). Whether the operator
   * actually mounts the MCP server is controlled separately via the
   * `MCP_ENABLED` environment variable — this flag is the schema author's
   * declaration of intent.
   *
   * The connecting MCP token's role still gates which operations execute:
   * a `viewer` token can only read/list even when `aiAccess.operations`
   * permits create/update/delete.
   *
   * @example AI-callable contacts table with hand-written description
   * ```typescript
   * aiAccess: {
   *   enabled: true,
   *   operations: ['read', 'list', 'create', 'update'],
   *   description: 'Customer contacts. Use this when the user asks about people or deals. Email is unique.',
   *   fieldExposure: 'permissioned',
   * }
   * ```
   *
   * @see AiAccessSchema for full configuration options
   */
  aiAccess: Schema.optional(AiAccessSchema),
}).pipe(
  Schema.annotations({
    identifier: 'Table',
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
  }),
  Schema.filter(validateTableSchema)
)

export type Table = Schema.Schema.Type<typeof TableSchema>

// Re-export all table model schemas and types for convenient imports
export * from './constraints'
export * from './fields/field-name'
export * from './fields/field-types'
export * from './fields'
export * from './foreign-keys'
export * from './id'
export * from './indexes'
export * from './name'
export * from './permissions'
export * from './primary-key'
export * from './row-level-permissions'
export * from './views'
