/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionBaseFields } from '../base'
import {
  CommentActionCommentIdSchema,
  CommentActionRecordIdSchema,
  CommentActionTableSchema,
  commentRunAsSchema,
} from './props'

/**
 * Comment Action (type: comment, operator: delete)
 *
 * Remove a comment from a record's thread — the comment a sync brought in and
 * the other tool has since deleted, the note a workflow left and no longer
 * needs. The comment is soft-deleted, as the comments API deletes it.
 *
 * The comment is addressed by its thread AND its id, like the API's route: a
 * comment id from another record's thread is refused as a missing one, so a
 * step cannot reach a comment through a record it was not pointed at.
 *
 * As the triggering user, the API's own rules apply: they may delete their own
 * comment, a moderator may delete any comment, and nobody deletes anything on a
 * record they may not read. As the system, any comment of the thread may go.
 */
export const CommentDeleteActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('comment').pipe(
    Schema.annotate({
      description: "Constant value 'comment' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('delete').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'comment' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: CommentActionTableSchema,
    recordId: CommentActionRecordIdSchema,
    commentId: CommentActionCommentIdSchema,
    runAs: Schema.optional(
      commentRunAsSchema(
        "Whose rules the deletion meets. 'system' (default): any comment of the thread may be deleted. 'triggering-user': the comments API's rules for the triggering user — their own comment, or any comment if they moderate, and nothing on a record they may not read — falling back to 'system' for a trigger with no user. A run someone started by hand always deletes as that person."
      )
    ),
  }).annotate({
    description: 'The thread, the comment to delete, and whose rules the deletion meets.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CommentDeleteAction',
    title: 'Comment Delete Action',
    description:
      "Soft-delete one comment of a record's thread, as the system or under the triggering user's comment rules",
  })
)

/** @public */
export type CommentDeleteAction = Schema.Schema.Type<typeof CommentDeleteActionSchema>
