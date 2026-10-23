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

/**
 * `readState` keeps, per reader and per PARENT record, the last child she has
 * read. It is declared on the link field of the CHILD table (a message's
 * `channel`), because the relationship that makes a record a child already
 * lives there; a second key on the parent naming the relation again would be
 * a second way to say the same thing.
 *
 * The parent's rows then carry a read-only per-reader count of unread children
 * (`unreadCount`, or the name `as` gives). `as` is required only when two
 * `readState` relationships point at the same parent, and the uniqueness of
 * the names is an app-level rule (it needs the other tables), not this
 * field's.
 */
const READ_STATE_COUNT_NAME = /^[a-z][a-zA-Z0-9_]*$/

const ReadStateOptionsSchema = Schema.Struct({
  as: Schema.String.pipe(
    Schema.annotate({
      description:
        "Name of the read-only unread count the parent's rows carry for this relationship. Required when two relationships with readState point at the same parent table.",
      examples: ['unreadMessages', 'unreadReplies'],
    }),
    Schema.check(
      Schema.isPattern(READ_STATE_COUNT_NAME, {
        message:
          'readState.as names a count on the parent row: a letter first, then letters, digits or _ (for example unreadMessages).',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'Read State Options',
    description: 'Read state under a chosen count name.',
  })
)

export const RelationshipReadStateSchema = Schema.Union([
  Schema.Boolean,
  ReadStateOptionsSchema,
]).pipe(
  Schema.annotate({
    title: 'Read State',
    defaultNote: 'false',
    description:
      "Keeps, per reader, how far she has read the children of each parent record this field links to. The parent's rows then carry a read-only unreadCount: the children created after her last-read position that she may read, her own excepted. A message scroller showing those children marks them read as they are drawn and places a New marker above the first unread one. true uses the name unreadCount; { as } names the count, which is required when two relationships with readState point at the same parent.",
    examples: [true, { as: 'unreadMessages' }],
  })
)

export const RelationshipFieldSchema = BaseFieldSchema.pipe(
  Schema.fieldsAssign({
    type: Schema.Literal('relationship').pipe(
      Schema.annotate({
        description:
          "Constant value 'relationship' for type discrimination in discriminated unions",
      })
    ),
    relatedTable: Schema.String.pipe(
      Schema.annotate({
        description: 'Name of the related table',
      }),
      Schema.check(Schema.isNonEmpty({ message: 'relatedTable is required' }))
    ),
    relationType: Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'many-to-one',
        description: 'Type of relationship (defaults to many-to-one if not specified)',
      }),
      Schema.check(Schema.isNonEmpty({ message: 'relationType is required' })),
      Schema.withDecodingDefaultKey(Effect.succeed('many-to-one' as const))
    ),
    foreignKey: Schema.optional(
      columnReference(
        'Name of the foreign key field in the related table for one-to-many relationships'
      )
    ),
    displayField: Schema.optional(
      Schema.String.pipe(
        Schema.annotate({
          description:
            'Field of the related table shown as the label of a linked record, beside its stored key. The label is sent only to a reader allowed to read that field of the related table; anyone else receives the key alone. A grid column that sets its own displayField, or a request naming the field in ?labels=, takes precedence over this one for that column or that response.',
        }),
        Schema.check(Schema.isNonEmpty({ message: 'displayField is required' }))
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
        Schema.annotate({
          description:
            'Name of the field in the related table to reference (defaults to id). The referenced field must have a primary key or unique constraint.',
        }),
        Schema.check(Schema.isNonEmpty({ message: 'relatedField is required' }))
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
        Schema.annotate({
          description:
            'Maximum number of records this field may link to. Only meaningful alongside allowMultiple (default: unbounded)',
        }),
        Schema.check(Schema.isGreaterThan(0))
      )
    ),
    readState: Schema.optional(RelationshipReadStateSchema),
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
