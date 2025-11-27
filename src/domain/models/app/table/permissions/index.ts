/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableFieldPermissionsSchema } from './field-permission'
import { TablePermissionSchema } from './permission'
import { RecordPermissionsSchema } from './record-permission'

/**
 * Table Permissions Schema
 *
 * High-level RBAC permissions for table operations.
 * Each operation maps to a PostgreSQL RLS policy that is auto-generated.
 *
 * Operations:
 * - `read` → SELECT policy (USING clause)
 * - `create` → INSERT policy (WITH CHECK clause)
 * - `update` → UPDATE policy (USING + WITH CHECK clauses)
 * - `delete` → DELETE policy (USING clause)
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
 * @example Owner-based permissions
 * ```typescript
 * permissions: {
 *   read: { type: 'owner', field: 'user_id' },
 *   create: { type: 'authenticated' },
 *   update: { type: 'owner', field: 'user_id' },
 *   delete: { type: 'owner', field: 'user_id' },
 * }
 * ```
 *
 * @example With organization isolation
 * ```typescript
 * permissions: {
 *   read: { type: 'authenticated' },
 *   organizationScoped: true,
 * }
 * ```
 */
export const TablePermissionsSchema = Schema.Struct({
  /**
   * SELECT permission - who can read records from this table.
   * Generates RLS policy with USING clause.
   */
  read: Schema.optional(TablePermissionSchema),

  /**
   * INSERT permission - who can create new records in this table.
   * Generates RLS policy with WITH CHECK clause.
   */
  create: Schema.optional(TablePermissionSchema),

  /**
   * UPDATE permission - who can modify existing records in this table.
   * Generates RLS policy with both USING and WITH CHECK clauses.
   */
  update: Schema.optional(TablePermissionSchema),

  /**
   * DELETE permission - who can remove records from this table.
   * Generates RLS policy with USING clause.
   */
  delete: Schema.optional(TablePermissionSchema),

  /**
   * Organization isolation flag.
   *
   * When true, all queries are automatically filtered by `organization_id`
   * based on the current user's organization. This enforces multi-tenant
   * data isolation at the database level.
   *
   * Generates RLS policy: `USING (organization_id = current_organization_id())`
   *
   * Requires the table to have an `organization_id` field.
   */
  organizationScoped: Schema.optional(Schema.Boolean),

  /**
   * Field-level permissions for granular column access control.
   *
   * Allows restricting read/write access to specific fields based on roles.
   * Useful for sensitive data like salary, SSN, or internal notes.
   *
   * @example Restrict salary field to admins
   * ```typescript
   * fields: [
   *   { field: 'salary', read: { type: 'roles', roles: ['admin'] } }
   * ]
   * ```
   */
  fields: Schema.optional(TableFieldPermissionsSchema),

  /**
   * Record-level permissions (Row-Level Security).
   *
   * Defines PostgreSQL RLS policies with variable substitution.
   * Useful for owner-based or organization-scoped record filtering.
   *
   * @example User can only read their own records
   * ```typescript
   * records: [
   *   { action: 'read', condition: '{userId} = created_by' }
   * ]
   * ```
   */
  records: Schema.optional(RecordPermissionsSchema),
}).pipe(
  Schema.annotations({
    title: 'Table Permissions',
    description:
      'High-level RBAC permissions for table operations. Auto-generates PostgreSQL RLS policies.',
    examples: [
      // Public read, admin-only write
      {
        read: { type: 'public' as const },
        create: { type: 'roles' as const, roles: ['admin'] },
        update: { type: 'roles' as const, roles: ['admin'] },
        delete: { type: 'roles' as const, roles: ['admin'] },
      },
      // Owner-based access
      {
        read: { type: 'owner' as const, field: 'user_id' },
        create: { type: 'authenticated' as const },
        update: { type: 'owner' as const, field: 'user_id' },
        delete: { type: 'owner' as const, field: 'user_id' },
      },
      // With organization isolation
      {
        read: { type: 'authenticated' as const },
        organizationScoped: true,
      },
    ],
  })
)

export type TablePermissions = Schema.Schema.Type<typeof TablePermissionsSchema>

// Re-export all sub-schemas for external use
export * from './public'
export * from './authenticated'
export * from './roles'
export * from './owner'
export * from './custom'
export * from './permission'
export * from './field-permission'
export * from './record-permission'
