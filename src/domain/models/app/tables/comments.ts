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

const SpamProtectionSchema = Schema.Struct({
  honeypot: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Render a hidden honeypot input; submissions with non-empty honeypot value return 200 OK silently (default: true when guest comments enabled)',
      })
    )
  ),
  rateLimitPerIp: Schema.optional(
    Schema.Number.pipe(
      Schema.annotations({
        description:
          'Max comments per IP per minute; the (N+1)th submission within the window returns 429 (default: 5)',
      })
    )
  ),
  maxLinksBeforeModeration: Schema.optional(
    Schema.Number.pipe(
      Schema.annotations({
        description:
          'Comments whose body contains more than N URL-like substrings are auto-set to status:"pending" (default: 2)',
      })
    )
  ),
  blockedWords: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.annotations({
        description:
          'Case-insensitive substring matches against the comment body; any hit auto-sets status:"rejected"',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'CommentsSpamProtection',
    title: 'Comment Spam Protection',
    description:
      'Per-table spam guards (honeypot, rate limit, link threshold, blocked words) layered on top of the always-on F-03 anti-spam floor',
  })
)

const ModerationModeSchema = Schema.Literal('auto', 'manual', 'auth-required').pipe(
  Schema.annotations({
    identifier: 'CommentsModerationMode',
    title: 'Comment Moderation Mode',
    description:
      "Comment moderation policy: 'manual' (queue, default), 'auto' (publish immediately), 'auth-required' (publish immediately but require sign-in)",
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

  readTracking: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Opt-in per-user comment read/unread tracking; adds unreadCount to the read response and a mark-read endpoint (default: false, see DEC-045)',
      })
    )
  ),

  moderation: Schema.optional(Schema.Union(Schema.Boolean, ModerationModeSchema)),

  autoApprove: Schema.optional(AutoApproveSchema),

  spamProtection: Schema.optional(SpamProtectionSchema),
}).pipe(
  Schema.annotations({
    identifier: 'CommentsConfig',
    title: 'Comments Configuration',
    description:
      'Table-level comment configuration controlling guest access, threading, and moderation',
  })
)

export type CommentsConfig = typeof CommentsConfigSchema.Type
