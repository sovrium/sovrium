/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createCommentRequestSchema } from '@/domain/models/api/tables/comments'
import { decodeOrValidationResponse } from '@/presentation/api/runtime/effect-validator'
import type { App } from '@/domain/models/app'
import type { CommentSpamStatus } from '@/domain/models/app/tables/comment-spam-classification'
import type { Context } from 'hono'

/**
 * Create comment request validation
 *
 * Accepts either `content` (legacy) or `body` (Y-6 comment-posted trigger
 * spec) as the comment text — both validate as a non-empty string up to
 * 10,000 characters. Optional `parentCommentId` distinguishes replies
 * from top-level comments; optional `mentions[]` carries user IDs for the
 * trigger envelope, merged after the `@[<user id>]` markup the body carries.
 * Either way only people who can read the record count as mentioned.
 */
export interface CreateCommentBody {
  readonly content: string
  readonly parentCommentId?: string
  readonly mentions: readonly string[]
  /**
   * Guest identity. Present only for
   * unauthenticated guest submissions to a `guestComments: true` table.
   * The create write-path stores these alongside `userId: null` so the
   * comment can be attributed to the guest without a Better Auth user row.
   */
  readonly guestName?: string
  readonly guestEmail?: string
}

/**
 * Validate the comment text portion of the request body. Returns
 * `undefined` when neither `content` nor `body` is present, when both
 * are non-string, or when the resolved string is empty / over 10,000
 * characters.
 */
function validateCommentText(payload: Record<string, unknown>): string | undefined {
  const { content, body } = payload
  const candidate = typeof body === 'string' ? body : typeof content === 'string' ? content : ''
  if (candidate.length === 0 || candidate.length > 10_000) return undefined
  return candidate
}

/**
 * Validate create comment request body
 */
function validateCreateCommentBody(body: unknown): CreateCommentBody | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const payload = body as Record<string, unknown>

  const text = validateCommentText(payload)
  if (text === undefined) return undefined

  const { parentCommentId, mentions, guestName, guestEmail } = payload
  const validatedParent = typeof parentCommentId === 'string' ? parentCommentId : undefined
  const validatedMentions = Array.isArray(mentions)
    ? mentions.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const validatedGuestName =
    typeof guestName === 'string' && guestName.length > 0 ? guestName : undefined
  const validatedGuestEmail =
    typeof guestEmail === 'string' && guestEmail.length > 0 ? guestEmail : undefined

  return {
    content: text,
    parentCommentId: validatedParent,
    mentions: validatedMentions,
    guestName: validatedGuestName,
    guestEmail: validatedGuestEmail,
  }
}

/**
 * Judge the body of a comment post, LAST among the create gates.
 *
 * The published request schema decides first (same envelope as a route
 * validator), then the handler's own reading of it; either refusal is a 400.
 * Runs only once the sign-in, record, spam-trap and rate-limit gates have let
 * the post through, so a malformed body never reveals which of them it reached.
 */
export function judgeCreateCommentBody(c: Context, body: unknown): CreateCommentBody | Response {
  const decoded = decodeOrValidationResponse(c, createCommentRequestSchema, body, 'json')
  if (decoded instanceof Response) return decoded
  return (
    validateCreateCommentBody(body) ??
    c.json({ success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' }, 400)
  )
}

/**
 * PG-02 honeypot guard. When the table has `comments.guestComments: true` and
 * the request body contains a non-empty `honeypot` value, silently discard
 * the submission by returning HTTP 200 with `{ discarded: true }`. The 200
 * status (not 201) signals "accepted-but-not-created" to bots without leaking
 * which guard caught them. Always-on safety: enabled by default whenever
 * `guestComments: true`, even without an explicit `spamProtection.honeypot`
 * setting (zero-config safety floor per the PG-02 locked decision).
 */
export function isHoneypotEnabled(table: NonNullable<App['tables']>[number]): boolean {
  const cfg = (table.comments ?? {}) as {
    guestComments?: boolean
    spamProtection?: { honeypot?: boolean }
  }
  if (!cfg.guestComments) return false
  // Default: honeypot is on when guest comments are enabled. Disable only when
  // explicitly set to `false`.
  return cfg.spamProtection?.honeypot !== false
}

export function readHoneypotValue(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const value = (body as Record<string, unknown>).honeypot
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Combined moderation verdict for a freshly-submitted comment.
 *
 * Resolved at the gate boundary by combining the spam classification
 * (PG-02 spam-protection.spec.ts) and the moderation policy (PG-02
 * comment-moderation-queue.spec.ts). The combined precedence is:
 *
 *   1. spam `'rejected'` → `'rejected'` (always wins; obvious-spam
 *      never reaches the moderation queue)
 *   2. spam `'pending'` → `'pending'` (link-threshold flags content for
 *      review regardless of the table's moderation setting)
 *   3. spam `'approved'` AND moderation `'pending'` → `'pending'`
 *      (queue manual-mode comments without spam triggers)
 *   4. spam `'approved'` AND moderation `'approved'` → `'approved'`
 *
 * Note: a moderation policy of `'auth-required'` is enforced separately
 * at the gate (it returns a 401 BEFORE the verdict resolves) so it
 * doesn't appear in this type — only the published statuses do.
 */
export type CombinedModerationStatus = 'approved' | 'pending' | 'rejected'

/**
 * Combine the spam-classifier verdict with the moderation policy verdict.
 * Spam-verdicts of `'pending'`/`'rejected'` win over moderation policy so
 * obviously-spammy submissions never sit in the manual-review queue.
 */
export function combineModerationVerdicts(
  spamStatus: CommentSpamStatus,
  moderationStatus: 'approved' | 'pending'
): CombinedModerationStatus {
  if (spamStatus === 'rejected') return 'rejected'
  if (spamStatus === 'pending') return 'pending'
  // spamStatus === 'approved'
  return moderationStatus
}
