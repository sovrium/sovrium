/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const ForeignKeySchema = Schema.Struct({
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

  fields: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Foreign Key Fields',
      description: 'Local columns that reference the parent table',
    })
  ),

  referencedTable: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: 'Referenced Table',
      description: 'Parent table name that contains the referenced columns',
    })
  ),

  referencedFields: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      title: 'Referenced Fields',
      description: 'Columns in the parent table that are referenced',
    })
  ),

  onDelete: Schema.optional(
    Schema.Literal('cascade', 'set-null', 'restrict', 'no-action').pipe(
      Schema.annotations({
        title: 'On Delete Action',
        description: 'Referential action when parent row is deleted',
      })
    )
  ),

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
    description: 'Composite foreign key constraint for multi-column relationships between tables',
  })
)

export type ForeignKey = Schema.Schema.Type<typeof ForeignKeySchema>
