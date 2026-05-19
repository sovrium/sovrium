/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const AutoApproveSchema = Schema.Struct({
  authenticated: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Auto-approve comments from logged-in users' })
    )
  ),

  previouslyApproved: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Auto-approve guests with a previously approved comment',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'CommentsAutoApprove',
    title: 'Auto-Approve Rules',
    description: 'Rules for automatically approving comments when moderation is enabled',
  })
)

export const CommentsConfigSchema = Schema.Struct({
  guestComments: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Allow guest comments without authentication (default: false)',
      })
    )
  ),

  guestEmailRequired: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Require email for guest comments (default: true)' })
    )
  ),

  threading: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Enable single-level replies (default: false)' })
    )
  ),

  moderation: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Require approval before comments are visible (default: false)',
      })
    )
  ),

  autoApprove: Schema.optional(AutoApproveSchema),
}).pipe(
  Schema.annotations({
    identifier: 'CommentsConfig',
    title: 'Comments Configuration',
    description:
      'Table-level comment configuration controlling guest access, threading, and moderation',
  })
)

export type CommentsConfig = typeof CommentsConfigSchema.Type
