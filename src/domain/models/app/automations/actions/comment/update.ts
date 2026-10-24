/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import {
  CommentActionCommentIdSchema,
  CommentActionRecordIdSchema,
  CommentActionTableSchema,
  commentRunAsSchema,
} from './props'

/**
 * Comment Action (type: comment, operator: update)
 *
 * Replace the text of one comment of a record's thread — the status note a
 * workflow posted and now corrects, the comment a sync brought in and the
 * other tool has since edited. The comment keeps its id, its author, its date
 * and its place in the thread; only its content changes. Deleting and
 * re-posting is not a substitute: the new comment would have a new id and a
 * new date.
 *
 * It is the AUTHOR's edit. Its moderation status is the `moderate` operator's,
 * under the moderator's permission: two operators, because the two changes are
 * allowed to two different people.
 *
 * As the triggering user, the comments API's own edit rule applies: they may
 * edit their own comment, on a record they may read, and nobody else's. As the
 * system, any comment of the thread may be edited. The comment is addressed by
 * its thread AND its id, like `delete`: an id from another record's thread is
 * refused as a missing one.
 *
 * `content` is judged on the RESOLVED text by the handler, as `create` judges
 * it (1 to 10,000 characters): a template's length says nothing about what it
 * renders.
 */
export const CommentUpdateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('comment').pipe(
    Schema.annotate({
      description: "Constant value 'comment' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('update').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'comment' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: CommentActionTableSchema,
    recordId: CommentActionRecordIdSchema,
    commentId: CommentActionCommentIdSchema,
    content: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'New text of the comment, as a template. Once rendered it must hold 1 to 10,000 characters; `@[<user id>]` markup mentions a person. It replaces the old text; the id, author, date and place in the thread stay.',
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    runAs: Schema.optional(
      commentRunAsSchema(
        "Whose edit it is. 'system' (default): any comment of the thread may be edited. 'triggering-user': the comments API's edit rule for the triggering user — their own comment only, on a record they may read — falling back to 'system' for a trigger with no user. A run someone started by hand always edits as that person."
      )
    ),
  }).annotate({
    description: 'The thread, the comment to edit, its new text, and whose edit it is.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CommentUpdateAction',
    title: 'Comment Update Action',
    description:
      "Replace the text of one comment of a record's thread, keeping its id, author, date and place, as the system or under the triggering user's edit rule",
    howTo:
      "Correct a status note an earlier step posted: give the thread (`table`, `recordId`), the comment's id (e.g. '{{postNote.result.id}}') and the new `content`. To approve or hide a comment, use `operator: moderate` instead.",
  })
)

/** @public */
export type CommentUpdateAction = Schema.Schema.Type<typeof CommentUpdateActionSchema>
