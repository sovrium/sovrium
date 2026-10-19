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
 * Comment Action (type: comment, operator: create)
 *
 * Post a comment on a record's thread from a workflow — the comment a sync
 * brings in from another tool, the note a workflow leaves for the people who
 * follow the record.
 *
 * It is the records API's own post, minus the two guards that exist against a
 * stranger on the internet: the per-address rate limit and the spam heuristics
 * (the honeypot, blocked words, the link threshold). An automation is not
 * that stranger, whoever it runs as. Everything else is kept: the content is
 * judged like a posted one (non-empty, at most 10,000 characters), a reply
 * must answer a top-level comment of the same thread, the people it mentions
 * count only when they can read the record, the table's moderation policy
 * decides whether it is published or queued, and a published comment starts
 * the table's `comment` automations.
 *
 * `content` is the one length-bounded prop that is a TEMPLATE, so the bound is
 * checked on the RESOLVED text by the handler, never here: a short template
 * can render a long body, and a long one a short body.
 */
export const CommentCreateActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('comment').pipe(
    Schema.annotate({
      description: "Constant value 'comment' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('create').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'comment' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    table: CommentActionTableSchema,
    recordId: CommentActionRecordIdSchema,
    content: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          'Text of the comment, as a template. Once rendered it must hold 1 to 10,000 characters; `@[<user id>]` markup mentions a person.',
      }),
      Schema.check(Schema.isMinLength(1))
    ),
    parentCommentId: Schema.optional(
      CommentActionCommentIdSchema.pipe(
        Schema.annotate({
          description:
            'Makes the comment a reply. Must name a top-level comment on the same record; a reply to a reply is refused.',
        })
      )
    ),
    mentions: Schema.optional(
      Schema.Array(TemplateStringSchema).pipe(
        Schema.annotate({
          description:
            'User ids the comment mentions, merged with the `@[<user id>]` markup of `content`. Only people who can read the record count as mentioned.',
        })
      )
    ),
    runAs: Schema.optional(
      commentRunAsSchema(
        "Whose comment it is. 'system' (default): the comment has no author account and is shown as written by the app; the table's comment permissions do not apply. 'triggering-user': the comment is the triggering user's — it carries their name, meets the table's comment and record read permissions exactly as their own post would, and is theirs to edit and delete — falling back to 'system' for a trigger with no user. A run someone started by hand is always that person's."
      )
    ),
  }).annotate({
    description:
      'The thread to post on, the text, an optional comment it replies to, who it mentions, and whose comment it is.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'CommentCreateAction',
    title: 'Comment Create Action',
    description:
      "Post a comment on a record's thread, through the same content, reply, mention, moderation and comment-trigger rules as the comments API",
  })
)

/** @public */
export type CommentCreateAction = Schema.Schema.Type<typeof CommentCreateActionSchema>
