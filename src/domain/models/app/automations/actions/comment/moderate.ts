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

/** The three moderation statuses a comment can hold, as the comments API stores them. */
export const COMMENT_MODERATION_STATUSES = ['approved', 'pending', 'rejected'] as const

/**
 * Comment Action (type: comment, operator: moderate)
 *
 * Change the moderation status of one comment of a record's thread — approve
 * a comment a manual-moderation table queued, hide one a classifier flagged.
 * The content is never touched: that is the `update` operator's, under the
 * author's permission.
 *
 * It is the MODERATOR's change, so it meets the comments API's moderation
 * rule: as the triggering user, it is allowed only when they moderate the
 * table's comments; as the system, any comment of the thread may be moderated.
 * The comment is addressed by its thread AND its id: an id from another
 * record's thread is refused as a missing one.
 *
 * The status is a closed literal set, not a template: three values, and a
 * template could only ever fail at run time.
 */
export const CommentModerateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('comment').pipe(
    Schema.annotate({
      description: "Constant value 'comment' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('moderate').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'comment' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: CommentActionTableSchema,
    recordId: CommentActionRecordIdSchema,
    commentId: CommentActionCommentIdSchema,
    status: Schema.Literals(COMMENT_MODERATION_STATUSES).pipe(
      Schema.annotate({
        description:
          "The comment's new moderation status. 'approved' publishes it, 'rejected' hides it from everyone who does not moderate, 'pending' puts it back in the moderation queue.",
      })
    ),
    runAs: Schema.optional(
      commentRunAsSchema(
        "Whose moderation it is. 'system' (default): any comment of the thread may be moderated. 'triggering-user': allowed only when the triggering user moderates the table's comments, as the comments API requires — falling back to 'system' for a trigger with no user. A run someone started by hand always moderates as that person."
      )
    ),
  }).annotate({
    description: 'The thread, the comment, its new moderation status, and whose decision it is.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CommentModerateAction',
    title: 'Comment Moderate Action',
    description:
      "Set the moderation status of one comment of a record's thread — approved, pending or rejected — without touching its content, as the system or under the triggering user's moderator permission",
    howTo:
      "Approve a queued comment: give the thread (`table`, `recordId`), the comment's id and `status: approved`. To change what the comment says, use `operator: update` instead.",
  })
)

/** @public */
export type CommentModerateAction = Schema.Schema.Type<typeof CommentModerateActionSchema>
