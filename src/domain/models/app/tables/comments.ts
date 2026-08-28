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
      Schema.annotate({ description: 'Auto-approve comments from logged-in users' })
    )
  ),

  /** Auto-approve guests who had a prior approved comment */
  previouslyApproved: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description: 'Auto-approve guests with a previously approved comment',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'CommentsAutoApprove',
    title: 'Auto-Approve Rules',
    description: 'Rules for automatically approving comments when moderation is enabled',
  })
)

/**
 * Spam Protection Configuration (PG-02)
 *
 * Per-table spam guards layered on top of F-03's always-on rate-limit/IP-hash
 * floor. Honeypot, link-threshold, and blocked-word checks all run server-side
 * in the comment-create pipeline so a direct API call cannot bypass them.
 */
const SpamProtectionSchema = Schema.Struct({
  /** Render a hidden honeypot input; filled submissions are silently discarded (HTTP 200, no comment created). */
  honeypot: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Render a hidden honeypot input; submissions with non-empty honeypot value return 200 OK silently (default: true when guest comments enabled)',
      })
    )
  ),
  /** Max comments per IP per minute. 6th submission returns 429. */
  rateLimitPerIp: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Max comments per IP per minute; the (N+1)th submission within the window returns 429 (default: 5)',
      })
    )
  ),
  /** Comments containing more links than this are auto-set to status: 'pending'. */
  maxLinksBeforeModeration: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Comments whose body contains more than N URL-like substrings are auto-set to status:"pending" (default: 2)',
      })
    )
  ),
  /** Blocked words (case-insensitive substring match) → auto status: 'rejected'. */
  blockedWords: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotate({
        description:
          'Case-insensitive substring matches against the comment body; any hit auto-sets status:"rejected"',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'CommentsSpamProtection',
    title: 'Comment Spam Protection',
    description:
      'Per-table spam guards (honeypot, rate limit, link threshold, blocked words) layered on top of the always-on F-03 anti-spam floor',
  })
)

/**
 * Moderation mode (PG-02 locked decision)
 *
 * - `'manual'` (default): every new comment enters status:"pending" and waits for owner approval.
 * - `'auto'`: comments enter status:"approved" immediately (spam guards may still flip to pending/rejected).
 * - `'auth-required'`: only authenticated users may post; comments enter status:"approved" immediately.
 */
const ModerationModeSchema = Schema.Literals(['auto', 'manual', 'auth-required']).pipe(
  Schema.annotate({
    identifier: 'CommentsModerationMode',
    title: 'Comment Moderation Mode',
    description:
      "Comment moderation policy: 'manual' (queue, default), 'auto' (publish immediately), 'auth-required' (publish immediately but require sign-in)",
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
      Schema.annotate({
        description: 'Allow guest comments without authentication (default: false)',
      })
    )
  ),

  /** Require email for guest comments */
  guestEmailRequired: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Require email for guest comments (default: true)' })
    )
  ),

  /** Enable single-level threading (replies) */
  threading: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({ description: 'Enable single-level replies (default: false)' })
    )
  ),

  /**
   * Opt-in per-user comment read/unread tracking.
   *
   * When `true`, the comment read response carries an `unreadCount` for the
   * authenticated user (comments they have not yet read; a user's own comments
   * never count), and a per-record `POST .../comments/read` endpoint marks the
   * record's comments read for that user. Read-state is per-user and isolated.
   * Powers an "unread comments" inbox (e.g. Sovrium Partner's engineer
   * dashboard). Default `false` — no read-state is written and no `unreadCount`
   * is returned, preserving the stateless behavior.
   *
   * Implemented: the per-user read-state, the mark-read endpoint, and
   * the `unreadCount` projection ship as an opt-in capability. See
   * `[internal ref]` [internal ref] and
   * `[internal ref]`.
   */
  readTracking: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        description:
          'Opt-in per-user comment read/unread tracking; adds unreadCount to the read response and a mark-read endpoint (default: false)',
      })
    )
  ),

  /**
   * Moderation policy (PG-02). A tri-state literal: `'auto'`, `'manual'` or
   * `'auth-required'`. A `boolean` shape was also accepted (`true` ≡ manual,
   * `false` ≡ auto) and has been removed. Default at the create-pipeline level
   * is `'manual'`.
   */
  moderation: Schema.optional(ModerationModeSchema),

  /** Auto-approve rules when moderation is enabled */
  autoApprove: Schema.optional(AutoApproveSchema),

  /**
   * Per-table spam protection (PG-02). When `guestComments: true` and this is
   * unset, conservative defaults are applied at the create-pipeline boundary.
   */
  spamProtection: Schema.optional(SpamProtectionSchema),
}).pipe(
  Schema.annotate({
    identifier: 'CommentsConfig',
    title: 'Comments Configuration',
    description:
      'Table-level comment configuration controlling guest access, threading, and moderation',
  })
)

/** @public */
export type CommentsConfig = typeof CommentsConfigSchema.Type
