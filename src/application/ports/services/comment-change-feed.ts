/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Effect } from 'effect'

/** A change to one record's comment thread, as its live feed announces it. */
export interface CommentChange {
  /** The app whose channels carry the change (its `name`). */
  readonly appId: string
  readonly table: string
  readonly recordId: string
  readonly commentId: string
  readonly event: 'created' | 'edited' | 'deleted' | 'moderated'
  /**
   * The comment's moderation status after the change: an approved comment's
   * change reaches every reader of the record, any other only its moderators
   * and its author.
   */
  readonly status: 'approved' | 'pending' | 'rejected'
  /** Its author's account, or null for a guest's or the app's own comment. */
  readonly authorId: string | null
}

/** Where a comment change is announced. */
export interface CommentChangeFeedShape {
  readonly announce: (change: CommentChange) => Effect.Effect<void>
}

/**
 * The live comment feed. A REFERENCE with a silent default, as the record
 * change feed is: a program announcing a comment change names no new
 * requirement, and a runtime that carries no live connections (a test, a
 * one-shot CLI run) announces into nothing.
 */
export const CommentChangeFeed = Context.Reference<CommentChangeFeedShape>(
  'sovrium/CommentChangeFeed',
  { defaultValue: () => ({ announce: () => Effect.void }) }
)
