/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TableIdSchema } from '@/domain/models/app/common/branded-ids'
import { FieldsSchema } from './fields'
import { IndexesSchema } from './indexes'
import { NameSchema } from './name'
import { TablePermissionsSchema } from './permissions'
import { PrimaryKeySchema } from './primary-key'
import { UniqueConstraintsSchema } from './unique-constraints'
import { ViewSchema } from './views'

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

export const TableSchema = Schema.Struct({
  id: Schema.optionalWith(TableIdSchema, {
    default: () => {
      // Note: This default is overridden by TablesSchema transformation
      // which ensures uniqueness across all tables
      return 1
    },
  }),
  name: NameSchema,
  fields: FieldsSchema,
  primaryKey: Schema.optional(PrimaryKeySchema),
  uniqueConstraints: Schema.optional(UniqueConstraintsSchema),
  indexes: Schema.optional(IndexesSchema),
  views: Schema.optional(Schema.Array(ViewSchema)),

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
export * from './id'
export * from './field-name'
export * from './name'
export * from './fields'
export * from './primary-key'
export * from './unique-constraints'
export * from './indexes'
export * from './field-types'
export * from './views'
export * from './permissions'
