/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BaseFieldSchema } from './base-field'

export const RelationshipFieldSchema = BaseFieldSchema.pipe(
  Schema.extend(
    Schema.Struct({
      type: Schema.Literal('relationship'),
      relatedTable: Schema.String.pipe(
        Schema.nonEmptyString({ message: () => 'relatedTable is required' }),
        Schema.annotations({
          description: 'Name of the related table',
        })
      ),
      relationType: Schema.String.pipe(
        Schema.annotations({
          description: 'Type of relationship',
        })
      ),
      foreignKey: Schema.optional(
        Schema.String.pipe(
          Schema.nonEmptyString({ message: () => 'foreignKey is required' }),
          Schema.annotations({
            description:
              'Name of the foreign key field in the related table for one-to-many relationships',
          })
        )
      ),
      displayField: Schema.optional(
        Schema.String.pipe(
          Schema.nonEmptyString({ message: () => 'displayField is required' }),
          Schema.annotations({
            description: 'Field from related table to display in UI',
          })
        )
      ),
      onDelete: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: 'Action to take when the related record is deleted',
          })
        )
      ),
      onUpdate: Schema.optional(
        Schema.String.pipe(
          Schema.annotations({
            description: "Action to take when the related record's key is updated",
          })
        )
      ),
      reciprocalField: Schema.optional(
        Schema.String.pipe(
          Schema.nonEmptyString({ message: () => 'reciprocalField is required' }),
          Schema.annotations({
            description:
              'Name of the reciprocal link field in the related table for bidirectional relationships',
          })
        )
      ),
      allowMultiple: Schema.optional(
        Schema.Boolean.pipe(
          Schema.annotations({
            description:
              'Whether to allow linking to multiple records (default: true for many-to-many)',
          })
        )
      ),
      limitToView: Schema.optional(
        Schema.String.pipe(
          Schema.nonEmptyString({ message: () => 'limitToView is required' }),
          Schema.annotations({
            description: 'Name of the view to limit linkable records to',
          })
        )
      ),
    })
  ),
  Schema.annotations({
    title: 'Relationship Field',
    description: 'Links records to another table with referential integrity.',
    examples: [
      {
        id: 1,
        name: 'author',
        type: 'relationship',
        relatedTable: 'users',
        relationType: 'many-to-one',
      },
    ],
  })
)

export type RelationshipField = Schema.Schema.Type<typeof RelationshipFieldSchema>
