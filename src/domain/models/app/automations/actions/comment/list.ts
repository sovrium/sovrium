/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import { CommentActionRecordIdSchema, CommentActionTableSchema, commentRunAsSchema } from './props'

/**
 * Comment Action (type: comment, operator: list)
 *
 * Read a record's thread, oldest first, so a later step can act on it — sync
 * it elsewhere, summarise it, find whether a note was already left.
 *
 * Who reads decides what is read, as on the comments API: the system reads
 * every comment that is not deleted, whatever its moderation status, and each
 * comment carries its `status`; the triggering user reads the thread as they
 * would read it themselves — nothing at all on a record they may not read, and
 * only published comments unless they moderate.
 *
 * The output never carries an author's email: a step's output is shown in the
 * run history, and the comments API keeps that address off every read for the
 * same reason.
 */
export const CommentListActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('comment').pipe(
    Schema.annotate({
      description: "Constant value 'comment' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('list').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'comment' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: CommentActionTableSchema,
    recordId: CommentActionRecordIdSchema,
    limit: Schema.optional(
      Schema.Finite.pipe(
        Schema.annotate({
          defaultNote: 'every comment',
          description: 'Maximum comments to return, oldest first (1-1000)',
        }),
        Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 1000 }))
      )
    ),
    runAs: Schema.optional(
      commentRunAsSchema(
        "Whose reading of the thread the step makes. 'system' (default): every comment not deleted, pending and rejected ones included. 'triggering-user': what the triggering user would read through the comments API — nothing on a record they may not read, published comments only unless they moderate — falling back to 'system' for a trigger with no user. A run someone started by hand always reads as that person."
      )
    ),
  }).annotate({
    description: 'The thread to read, how many comments to return, and whose reading it is.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CommentListAction',
    title: 'Comment List Action',
    description:
      "Read a record's comments, oldest first, as the system or as the triggering user would read them",
  })
)

/** @public */
export type CommentListAction = Schema.Schema.Type<typeof CommentListActionSchema>
