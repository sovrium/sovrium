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

/**
 * Comment Action — union of the three operators on a record's thread.
 *
 * `create` routes through the SAME application use-case the comments API's
 * post calls, minus the two anti-abuse guards only an anonymous caller needs.
 * A second write path would have to re-derive the reply rule, the mention
 * audience, the moderation verdict and the comment-trigger fan-out, and a
 * second copy of a rule is a rule that eventually disagrees with the first.
 *
 * There is no `update` yet: editing a comment in place is a later addition,
 * and deleting then re-posting is not a substitute for it (the new comment has
 * a new id and a new date).
 */
export const CommentActionSchema = Schema.Union([
  CommentCreateActionSchema,
  CommentListActionSchema,
  CommentDeleteActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'CommentAction',
    title: 'Comment Action',
    description:
      "Post, read or delete comments on a record's thread from a workflow, as the app or as the triggering user",
  })
)

/** @public */
export type CommentAction = Schema.Schema.Type<typeof CommentActionSchema>
