/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const CommentTriggerFilterSchema = Schema.Struct({
  topLevelOnly: Schema.optional(Schema.Boolean),
  repliesOnly: Schema.optional(Schema.Boolean),
  mentionsOnly: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: 'CommentTriggerFilter',
    title: 'Comment Trigger Filter',
    description:
      'Optional narrowing filters on the comment-posted trigger: top-level vs reply, mentions-only',
  }),
  Schema.filter((filter) => {
    if (filter.topLevelOnly && filter.repliesOnly) {
      return 'topLevelOnly and repliesOnly are mutually exclusive'
    }
    return undefined
  })
)

export type CommentTriggerFilter = Schema.Schema.Type<typeof CommentTriggerFilterSchema>

export const CommentTriggerSchema = Schema.Struct({
  type: Schema.Literal('comment'),
  table: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({ description: 'Name of the table with comments enabled' })
  ),
  when: Schema.optional(
    Schema.Literal('approved', 'created', 'any').pipe(
      Schema.annotations({
        description:
          'Filter when the trigger fires: approved (only moderated-approved), created (any new comment), any (all comment events). Default: created.',
      })
    )
  ),
  filter: Schema.optional(CommentTriggerFilterSchema),
  respectReadPermissions: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: 'CommentTrigger',
    title: 'Comment Trigger',
    description:
      'Trigger automation when a comment is created on a record. Provides $trigger.comment.*, $trigger.record.*, $trigger.threadParticipants, $trigger.mentions context variables.',
  })
)

export type CommentTrigger = Schema.Schema.Type<typeof CommentTriggerSchema>
