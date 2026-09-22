/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import { createDatabaseIdentifierSchema } from '@/domain/kernel/sql/database-identifier'
import { BaseFieldSchema } from '../base-field'

/**
 * `foreignKey` and `reciprocalField` both NAME A COLUMN, and both are resolved
 * verbatim into generated DDL — the join predicate of a `count` / `rollup`
 * subquery, which cannot bind an identifier as a parameter.
 *
 * They therefore carry the same identifier rule as a field's own `name`
 * (standing rule S3). Before this, they were only checked for non-emptiness:
 * a value that is not a legal column name reached `CREATE VIEW` intact, where
 * at best it produced a startup DDL failure that stopped the server booting,
 * and at worst it was not an identifier at all. Validating here means the
 * config that boots is the config whose SQL can be generated — the same
 * guarantee the foreign-key RESOLVER already gives for which column is chosen.
 *
 * The description is threaded INTO the identifier schema rather than annotated
 * onto the result: Effect's JSON Schema generator reads the innermost node, so
 * an annotation applied afterwards is dropped from the published schema authors
 * write against.
 */
const columnReference = (description: string) =>
  createDatabaseIdentifierSchema('column', description)

/**
 * `allowCreate` and `maxLinked` are properties of the FIELD, not of any page
 * component, for the same reason `allowMultiple` already is: a `relationship`
 * column IS a record picker wherever it is bound, exactly as a `single-select`
 * column is already a dropdown wherever IT is bound. Neither needs a
 * `type: record-picker` component for an author to declare, and minting one
 * would create a second way to say what the column already says.
 *
 * `maxLinked` is an `Int` above zero rather than a plain number: a cap of zero
 * would express "this field may link to nothing", which is what omitting the
 * field says, and a fractional cap has no meaning against a count of records.
 * It is only meaningful alongside `allowMultiple`, and that pairing is left to
 * the author rather than refused here, because a cap declared ahead of the
 * `allowMultiple` it anticipates is harmless while a cross-property refusal on
 * a field union is not expressible without a validator pass.
 */

export const RelationshipFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('relationship'),
    relatedTable: Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'relatedTable is required' })),
      Schema.annotate({
        description: 'Name of the related table',
      })
    ),
    relationType: Schema.String.pipe(
      Schema.check(Schema.isNonEmpty({ message: 'relationType is required' })),
      Schema.annotate({
        description: 'Type of relationship (defaults to many-to-one if not specified)',
      }),
      Schema.withDecodingDefaultKey(Effect.succeed('many-to-one' as const))
    ),
    foreignKey: Schema.optional(
      columnReference(
        'Name of the foreign key field in the related table for one-to-many relationships'
      )
    ),
    displayField: Schema.optional(
      Schema.String.pipe(
        Schema.check(Schema.isNonEmpty({ message: 'displayField is required' })),
        Schema.annotate({
          description: 'Field from related table to display in UI',
        })
      )
    ),
    onDelete: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: 'Action to take when the related record is deleted',
        })
      )
    ),
    onUpdate: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description: "Action to take when the related record's key is updated",
        })
      )
    ),
    reciprocalField: Schema.optional(
      columnReference(
        'Name of the reciprocal link field in the related table for bidirectional relationships'
      )
    ),
    allowMultiple: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description:
            'Whether to allow linking to multiple records (default: true for many-to-many)',
        })
      )
    ),
    relatedField: Schema.optional(
      Schema.String.pipe(
        Schema.check(Schema.isNonEmpty({ message: 'relatedField is required' })),
        Schema.annotate({
          description:
            'Name of the field in the related table to reference (defaults to id). The referenced field must have a primary key or unique constraint.',
        })
      )
    ),
    allowCreate: Schema.optional(
      Schema.Boolean.pipe(
        Schema.annotate({
          description:
            "Whether the picker may create a missing related record inline, by posting the typed text as the related table's displayField (default: false)",
        })
      )
    ),
    maxLinked: Schema.optional(
      Schema.Int.pipe(
        Schema.check(Schema.isGreaterThan(0)),
        Schema.annotate({
          description:
            'Maximum number of records this field may link to. Only meaningful alongside allowMultiple (default: unbounded)',
        })
      )
    ),
  }),
  Schema.annotate({
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

/** @public */
export type RelationshipField = Schema.Schema.Type<typeof RelationshipFieldSchema>
