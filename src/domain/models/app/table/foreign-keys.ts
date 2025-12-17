/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Foreign Key Constraint Schema
 *
 * Defines a composite foreign key constraint that references multiple columns
 * in another table. Used for multi-column relationships where the uniqueness
 * constraint spans multiple fields.
 *
 * @example Composite foreign key
 * ```typescript
 * {
 *   name: 'fk_permissions_tenant_user',
 *   fields: ['tenant_id', 'user_id'],
 *   referencedTable: 'tenant_users',
 *   referencedFields: ['tenant_id', 'user_id']
 * }
 * ```
 */
export const ForeignKeySchema = Schema.Struct({
  /**
   * Constraint name (used in PostgreSQL constraint naming)
   * @example "fk_permissions_tenant_user"
   */
  name: Schema.String.pipe(
    Schema.minLength(1),
    Schema.maxLength(63),
    Schema.pattern(/^[a-z_][a-z0-9_]*$/),
    Schema.annotations({
      title: 'Foreign Key Name',
      description:
        'Constraint name following PostgreSQL naming conventions (lowercase, underscores, max 63 chars)',
    })
  ),

  /**
   * Local column names that form the foreign key
   * @example ["tenant_id", "user_id"]
   */
  fields: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Foreign Key Fields',
      description: 'Local columns that reference the parent table',
    })
  ),

  /**
   * Referenced table name
   * @example "tenant_users"
   */
  referencedTable: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: 'Referenced Table',
      description: 'Parent table name that contains the referenced columns',
    })
  ),

  /**
   * Referenced column names in the parent table
   * @example ["tenant_id", "user_id"]
   */
  referencedFields: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Referenced Fields',
      description: 'Columns in the parent table that are referenced',
    })
  ),

  /**
   * Action to take on DELETE
   * @default "restrict"
   */
  onDelete: Schema.optional(
    Schema.Literal('cascade', 'set-null', 'restrict', 'no-action').pipe(
      Schema.annotations({
        title: 'On Delete Action',
        description: 'Referential action when parent row is deleted',
      })
    )
  ),

  /**
   * Action to take on UPDATE
   * @default "no-action"
   */
  onUpdate: Schema.optional(
    Schema.Literal('cascade', 'set-null', 'restrict', 'no-action').pipe(
      Schema.annotations({
        title: 'On Update Action',
        description: 'Referential action when parent primary key is updated',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    title: 'Foreign Key',
    description:
      'Composite foreign key constraint for multi-column relationships between tables',
  })
)

export type ForeignKey = Schema.Schema.Type<typeof ForeignKeySchema>
