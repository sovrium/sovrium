/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Comment spam classification (PG-02).
 *
 * Pure-domain helpers for the link-threshold + blocked-words spam guards
 * wired into the comment-create pipeline (see
 * `src/presentation/api/routes/tables/comment-handlers.ts`). Honeypot lives
 * inline in the handler because it short-circuits the request before
 * reading the body; the helpers here run AFTER body-parse on every accepted
 * submission so they need to be cheap and deterministic.
 *
 * Classification precedence (locked PG-02 decision):
 *
 *   1. blocked-words match (case-insensitive substring) → `'rejected'`
 *   2. link count exceeds `maxLinksBeforeModeration` → `'pending'`
 *   3. otherwise → `'approved'`
 *
 * Both guards default to "off" when their spam-protection field is unset —
 * a configuration that turns ON guest comments without an explicit
 * `spamProtection` block still gets the honeypot + rate-limit floor but no
 * content-based classification. This keeps zero-config blogs from
 * accidentally rejecting legitimate visitor comments that happen to
 * include a link.
 */

/** Result of classifying a comment body against the configured spam guards. */
export type CommentSpamStatus = 'approved' | 'pending' | 'rejected'

/** Per-table spam-protection knobs read by the classifier. */
export interface CommentSpamProtectionConfig {
  /** Comments whose body contains MORE than N URL-like substrings are flagged. */
  readonly maxLinksBeforeModeration?: number
  /** Case-insensitive substring matches against the comment body. */
  readonly blockedWords?: ReadonlyArray<string>
}

/**
 * Count URL-like substrings in `content`. Matches `http://`, `https://`,
 * and `www.` prefixes — covers the common bot patterns without trying to
 * be a full RFC 3986 parser. Case-insensitive.
 *
 * Returns 0 for empty / whitespace-only input.
 *
 * @public
 */
export function countLinks(content: string): number {
  if (content.length === 0) return 0
  const pattern = /https?:\/\/|www\./gi
  const matches = content.match(pattern)
  return matches?.length ?? 0
}

/**
 * Return `true` when `content` contains any of `words` as a
 * case-insensitive substring. Words are matched verbatim (no
 * tokenization) so phrases with hyphens or spaces work.
 *
 * Empty / missing `words` always returns `false`.
 *
 * @public
 */
export function hasBlockedWord(content: string, words: ReadonlyArray<string>): boolean {
  if (words.length === 0) return false
  const lowered = content.toLowerCase()
  return words.some((word) => {
    if (word.length === 0) return false
    return lowered.includes(word.toLowerCase())
  })
}

/**
 * Classify a comment body against the table's spam-protection config.
 *
 * The order is locked: blocked-words wins over link-threshold so a comment
 * containing both a blocked term AND too many links is rejected (not just
 * queued for moderation). Operators reading the moderation queue should
 * not see "obvious spam" rows there — those go straight to the rejected
 * bucket.
 *
 * @public
 */
export function classifyCommentBySpam(
  content: string,
  config: CommentSpamProtectionConfig | undefined
): CommentSpamStatus {
  if (config === undefined) return 'approved'
  const blockedWords = config.blockedWords ?? []
  if (hasBlockedWord(content, blockedWords)) return 'rejected'
  const threshold = config.maxLinksBeforeModeration
  if (typeof threshold === 'number' && countLinks(content) > threshold) return 'pending'
  return 'approved'
}
