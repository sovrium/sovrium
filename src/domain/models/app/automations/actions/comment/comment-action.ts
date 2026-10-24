/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { CommentCreateActionSchema } from './create'
import { CommentDeleteActionSchema } from './delete'
import { CommentListActionSchema } from './list'
import { CommentModerateActionSchema } from './moderate'
import { CommentUpdateActionSchema } from './update'

/**
 * Comment Action — union of the five operators on a record's thread.
 *
 * `create` routes through the SAME application use-case the comments API's
 * post calls, minus the two anti-abuse guards only an anonymous caller needs.
 * A second write path would have to re-derive the reply rule, the mention
 * audience, the moderation verdict and the comment-trigger fan-out, and a
 * second copy of a rule is a rule that eventually disagrees with the first.
 *
 * Editing a comment is two operators, not one, because it is two permissions:
 * `update` changes the text under the AUTHOR's edit rule, `moderate` changes
 * the status under the MODERATOR's. Deleting then re-posting is no substitute
 * for either (the new comment has a new id and a new date).
 */
export const CommentActionSchema = Schema.Union([
  CommentCreateActionSchema,
  CommentListActionSchema,
  CommentDeleteActionSchema,
  CommentUpdateActionSchema,
  CommentModerateActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'CommentAction',
    title: 'Comment Action',
    description:
      "Post, read, edit, moderate or delete comments on a record's thread from a workflow, as the app or as the triggering user",
  })
)

/** @public */
export type CommentAction = Schema.Schema.Type<typeof CommentActionSchema>
