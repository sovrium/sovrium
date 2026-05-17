/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Auto-Approve Configuration
 *
 * Rules for automatically approving comments when moderation is enabled.
 */
const AutoApproveSchema = Schema.Struct({
  /** Auto-approve comments from authenticated users */
  authenticated: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Auto-approve comments from logged-in users' })
    )
  ),

  /** Auto-approve guests who had a prior approved comment */
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

/**
 * Comments Configuration Schema
 *
 * Table-level configuration for the comment system.
 * Controls guest comments, threading, moderation, and spam protection.
 */
export const CommentsConfigSchema = Schema.Struct({
  /** Allow guest (unauthenticated) comments */
  guestComments: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Allow guest comments without authentication (default: false)',
      })
    )
  ),

  /** Require email for guest comments */
  guestEmailRequired: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Require email for guest comments (default: true)' })
    )
  ),

  /** Enable single-level threading (replies) */
  threading: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Enable single-level replies (default: false)' })
    )
  ),

  /** Enable moderation approval queue */
  moderation: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Require approval before comments are visible (default: false)',
      })
    )
  ),

  /** Auto-approve rules when moderation is enabled */
  autoApprove: Schema.optional(AutoApproveSchema),
}).pipe(
  Schema.annotations({
    identifier: 'CommentsConfig',
    title: 'Comments Configuration',
    description:
      'Table-level comment configuration controlling guest access, threading, and moderation',
  })
)

/** @public */
export type CommentsConfig = typeof CommentsConfigSchema.Type
