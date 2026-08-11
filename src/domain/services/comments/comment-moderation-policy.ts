/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Comment moderation policy (PG-02).
 *
 * Pure-domain helper that resolves the initial moderation status for a new
 * comment given the table-level `comments.moderation` setting + the
 * `autoApprove` rules + the request session. Mirrors the spam-classification
 * helper at [[comment-spam-classification.ts]] and is meant to run AFTER
 * the spam guards: a spam verdict of `'pending'` or `'rejected'` always
 * wins (so a comment full of blocked words never lands in the moderation
 * queue alongside legitimate-but-unreviewed content).
 *
 * Locked precedence (PG-02 architect §9):
 *
 *   1. `moderation: 'auto'` (or unset) → `'approved'`
 *   2. `moderation: 'auth-required'` → `'approved'` (route layer enforces
 *      authentication BEFORE this helper runs; we just project the status)
 *   3. `moderation: 'manual'`:
 *      a. `autoApprove.authenticated: true` AND session is authenticated → `'approved'`
 *      b. `autoApprove.previouslyApproved: true` AND `priorApprovedCommentExists`
 *         is `true` (caller pre-resolves this from the comment-repo) → `'approved'`
 *      c. otherwise → `'pending'`
 *
 * Out of scope for this module: validating that the schema's
 * `moderation` value is one of the allowed shapes (Effect Schema does
 * that at decode time), and enforcing the `'auth-required'` rejection
 * (the route layer does that BEFORE invoking the create program).
 */

/** Resulting moderation status for a freshly-created comment. */
export type CommentModerationStatus = 'pending' | 'approved'

/**
 * Per-table moderation knobs this helper cares about. Kept local so the
 * helper can run against the raw schema slice without pulling Effect
 * Schema decode machinery into the request hot path.
 */
export interface CommentModerationConfig {
  /**
   * The tri-state literal (see [[ModerationModeSchema]] at
   * `src/domain/models/app/tables/comments.ts`). A `boolean` shape was also
   * accepted -- `true` ≡ `'manual'`, `false` ≡ `'auto'` -- and was removed.
   */
  readonly moderation?: 'auto' | 'manual' | 'auth-required'
  readonly autoApprove?: {
    readonly authenticated?: boolean
    readonly previouslyApproved?: boolean
  }
}

/**
 * Request-time inputs that influence the moderation gate verdict.
 */
export interface CommentModerationContext {
  /** `true` when the request carries an authenticated session (NOT a guest). */
  readonly isAuthenticated: boolean
  /**
   * `true` when the caller has already resolved that a prior comment from
   * the same guest (matched by email — the only identifier guests carry)
   * was approved. The helper does NOT make this call itself so it stays
   * pure and synchronous; the route layer wires the repo lookup.
   *
   * Optional: defaults to `false`. Only consulted when `moderation: 'manual'`
   * AND `autoApprove.previouslyApproved: true`.
   */
  readonly priorApprovedCommentExists?: boolean
}

/**
 * `true` when the table's moderation setting requires queueing comments
 * for review by default. `'manual'` is the only mode that queues; `'auto'`,
 * unset, and `'auth-required'` do not. `'auth-required'` gates ACCESS rather
 * than review, so a comment that gets past it is not additionally queued.
 *
 * @public
 */
export function isModerationEnabled(config: CommentModerationConfig): boolean {
  return config.moderation === 'manual'
}

/**
 * Resolve the initial moderation status for a freshly-created comment.
 *
 * @public
 */
export function resolveCommentModerationStatus(
  config: CommentModerationConfig,
  context: CommentModerationContext
): CommentModerationStatus {
  if (!isModerationEnabled(config)) return 'approved'

  const autoApprove = config.autoApprove ?? {}

  if (autoApprove.authenticated === true && context.isAuthenticated) {
    return 'approved'
  }

  if (autoApprove.previouslyApproved === true && context.priorApprovedCommentExists === true) {
    return 'approved'
  }

  return 'pending'
}

/**
 * `true` when the table's moderation setting blocks guest (unauthenticated)
 * submissions outright. Returns `true` ONLY for `'auth-required'`; `'auto'`,
 * `'manual'` and unset all let guests through and rely on the
 * moderation-status gate to decide whether the comment is queued or
 * published.
 *
 * @public
 */
export function requiresAuthenticationForComment(config: CommentModerationConfig): boolean {
  return config.moderation === 'auth-required'
}
