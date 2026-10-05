/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { classifyCommentBySpam } from '@/domain/models/app/tables/comment-spam-classification'
import { checkAndRecord, type RateLimitPolicy } from '@/infrastructure/forms/form-rate-limiter'
import { hashIp, resolveIpHashSalt } from '@/infrastructure/forms/ip-hash'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import type { App } from '@/domain/models/app'
import type {
  CommentSpamProtectionConfig,
  CommentSpamStatus,
} from '@/domain/models/app/tables/comment-spam-classification'
import type { Context } from 'hono'

/**
 * Spam guards for the comment-create pipeline (PG-02).
 *
 * Co-located with `comment-handlers.ts` and split out so the handler file
 * stays under the 400-line ESLint cap. Each helper is a thin route-layer
 * adapter around a pure domain primitive:
 *
 * - `applyRateLimit` reuses [internal ref]'s in-process `checkAndRecord`
 *     (`infrastructure/forms/form-rate-limiter`) so comment rate-limits
 *     share the same sliding-window machinery as form submissions.
 *   - `classifySpam` calls the pure
 *     `classifyCommentBySpam` domain helper, which encodes the
 *     blocked-words-wins-over-link-threshold precedence.
 *
 * The honeypot guard stays inline in `comment-handlers.ts` because it
 * short-circuits BEFORE body validation; everything in this file runs
 * AFTER body validation and AFTER honeypot.
 */

/**
 * PG-02 locked defaults for the per-table comment spam-protection knobs.
 * Applied at the gate boundary when the schema omits a value but the
 * surrounding feature requires a floor (e.g. `guestComments: true`).
 */
const DEFAULT_RATE_LIMIT_PER_IP = 5
const DEFAULT_RATE_WINDOW_SECONDS = 60
const DEFAULT_RATE_LIMIT_PER_FORM = 1000 // permissive global ceiling — [internal ref] mirror

/**
 * Per-table comments config shape this guard cares about. Kept local
 * (rather than importing the Schema-derived type) so the guard can run
 * against the raw schema slice without pulling Effect Schema decode
 * machinery into the request hot path.
 */
interface CommentsGateConfig {
  readonly guestComments?: boolean
  readonly spamProtection?: {
    readonly rateLimitPerIp?: number
    readonly maxLinksBeforeModeration?: number
    readonly blockedWords?: ReadonlyArray<string>
  }
}

function readCommentsConfig(table: NonNullable<App['tables']>[number]): CommentsGateConfig {
  return (table.comments ?? {}) as CommentsGateConfig
}

/**
 * Resolve the rate-limit policy. Sovrium guarantees a rate-limit floor
 * whenever `guestComments: true` is set on the table — even when no
 * `spamProtection.rateLimitPerIp` is configured — so a misconfigured
 * blog cannot accidentally open the front door to a comment flood.
 *
 * Returns `undefined` when guest comments are off AND no explicit
 * `rateLimitPerIp` knob is set (authenticated-only comment threads
 * inherit the session-scoped rate-limiting Sovrium already applies at
 * the auth layer; we don't double-limit them here).
 */
export function resolveRateLimitPolicy(
  table: NonNullable<App['tables']>[number]
): RateLimitPolicy | undefined {
  const cfg = readCommentsConfig(table)
  const explicit = cfg.spamProtection?.rateLimitPerIp
  if (!cfg.guestComments && explicit === undefined) return undefined
  return {
    perIp: explicit ?? DEFAULT_RATE_LIMIT_PER_IP,
    perForm: DEFAULT_RATE_LIMIT_PER_FORM,
    windowSeconds: DEFAULT_RATE_WINDOW_SECONDS,
  }
}

/**
 * The limiter key a table's comments are counted under.
 *
 * The limiter's windows are shared with public form submissions, which are
 * keyed by form name. A form name matches `^[a-z][a-z0-9-]*$`, so a key with a
 * `:` can never be one: a form called `comments-tickets` no longer shares its
 * count with the comments on `tickets`.
 */
export const commentRateLimitKey = (tableName: string): string => `comments:${tableName}`

/**
 * Apply the rate-limit gate. When the resolved policy trips, returns a
 * 429 `Response` with a `Retry-After: <seconds>` header (RFC 7231).
 * Returns `undefined` when the policy passes (or is not applicable).
 *
 * Privacy: the limiter hashes the IP before any state lookup so raw
 * addresses never enter the per-process state map. See
 * `infrastructure/forms/ip-hash.ts` for the salt-resolution contract.
 */
export function applyRateLimit(input: {
  readonly c: Context
  readonly table: NonNullable<App['tables']>[number]
}): Response | undefined {
  const policy = resolveRateLimitPolicy(input.table)
  if (policy === undefined) return undefined
  const ip = getRequestRateLimitKey(input.c)
  const ipHash = hashIp(resolveIpHashSalt(), ip ?? '')
  const formName = commentRateLimitKey(input.table.name)
  const result = checkAndRecord({ ipHash, formName, policy })
  if (result.ok) return undefined
  // The 429 body intentionally does NOT leak the trip reason — mirrors
  // the [internal ref] forms rate-limit response shape.
  return input.c.json(
    errorBody({
      error: 'rate limit exceeded',
      message: 'Too many comments — try again shortly',
      code: ApiErrorCode.RATE_LIMITED,
    }),
    429,
    { 'Retry-After': String(result.retryAfterSec) }
  )
}

/**
 * Classify the comment body against the configured spam guards.
 *
 * Returns `'approved'` when no spam-protection block is configured, or
 * when the content passes both the blocked-words and link-threshold
 * checks. The caller passes the resulting status straight through to
 * the create-comment program so the row lands with the right
 * moderation state.
 */
export function classifySpam(
  table: NonNullable<App['tables']>[number],
  content: string
): CommentSpamStatus {
  const cfg = readCommentsConfig(table)
  const protection = cfg.spamProtection as CommentSpamProtectionConfig | undefined
  return classifyCommentBySpam(content, protection)
}
