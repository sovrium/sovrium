/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Comment Trigger Filter Schema
 *
 * Optional filters narrowing when the comment-posted trigger fires.
 *
 * - `topLevelOnly: true` — only fires for top-level comments (where
 *   `parentCommentId` is null). Replies are ignored.
 * - `repliesOnly: true` — only fires for reply comments (where
 *   `parentCommentId` is non-null).
 * - `mentionsOnly: true` — only fires when the comment body contains
 *   `@mentions`. Useful for "notify mentioned users" workflows.
 *
 * Mutually exclusive: `topLevelOnly` and `repliesOnly` cannot both be true.
 */
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

/** @public */
export type CommentTriggerFilter = Schema.Schema.Type<typeof CommentTriggerFilterSchema>

/**
 * Comment Trigger
 *
 * Triggered when a comment is created on a record in a specific table.
 * Supports filtering by comment lifecycle stage (approved, created, any),
 * by comment kind (top-level vs reply), and by content (mentions-only).
 *
 * Provides this payload to downstream actions:
 *
 * | Path                                         | Type         | Description                                        |
 * | -------------------------------------------- | ------------ | -------------------------------------------------- |
 * | `$trigger.record.*`                          | object       | The record the comment was posted on               |
 * | `$trigger.comment.id`                        | UUID         | Comment row id                                     |
 * | `$trigger.comment.body`                      | string       | Comment body (rich text)                           |
 * | `$trigger.comment.author.{id,email,name}`    | string       | Comment author                                     |
 * | `$trigger.comment.parentCommentId`           | UUID \| null | Null for top-level comments; UUID for replies      |
 * | `$trigger.threadParticipants`                | UUID[]       | Unique authors on the thread, EXCLUDING the new author |
 * | `$trigger.mentions`                          | UUID[]       | User ids mentioned in `@<name>` markup             |
 */
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
  /**
   * Optional content/structure filters narrowing trigger firing.
   *
   * These filters operate AFTER the lifecycle gate (`when`). E.g.,
   * `when: 'approved'` + `filter: { mentionsOnly: true }` fires only on
   * approved comments that mention at least one user.
   */
  filter: Schema.optional(CommentTriggerFilterSchema),
  /**
   * If true, the trigger respects the table's
   * `tablePermissions.read.when` predicate (Z-3) — i.e., the trigger
   * fires only when the **comment author** has read access to the
   * record. Defaults to true.
   */
  respectReadPermissions: Schema.optional(Schema.Boolean),
}).pipe(
  Schema.annotations({
    identifier: 'CommentTrigger',
    title: 'Comment Trigger',
    description:
      'Trigger automation when a comment is created on a record. Provides $trigger.comment.*, $trigger.record.*, $trigger.threadParticipants, $trigger.mentions context variables.',
  })
)

/** @public */
export type CommentTrigger = Schema.Schema.Type<typeof CommentTriggerSchema>
