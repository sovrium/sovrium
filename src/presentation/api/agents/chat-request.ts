/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A chat request before its turn runs: its decoded shape and its page scope,
 * and the two gates every chat transport passes first — AI enabled at all, and
 * the per-user rate limit.
 */

import { type ChatMessagePart } from '@/domain/models/api/ai/chat'
import { type ContextPageScope } from '@/domain/models/app/agents/ai-chat-context'
import {
  checkChatRateLimit,
  type ChatRateLimitDecision,
} from '@/infrastructure/process/chat-rate-limit'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { Context } from 'hono'

/** A decoded chat request. */
export interface ChatRequestPayload {
  readonly message: string
  /** The message as typed parts, when sent as parts: text and upload ids. */
  readonly parts?: ReadonlyArray<ChatMessagePart>
  readonly sessionId: string
  readonly agent?: string
  /**
   * Optional token confirming a previously-pending destructive action
   * When present and it resolves to a stashed
   * confirmation, an affirmative message commits the mutation.
   */
  readonly confirmationToken?: string
  /**
   * Optional page scope passed when the chat surface is embedded in a page
   * component declaring `allowedTables`. Not part
   * of `chatRequestSchema` — it is a presentation-layer concern read straight
   * off the raw body so the context builder can narrow the table list.
   */
  readonly pageContext?: ContextPageScope
  /** The message the turn follows: the end of the branch the window shows. */
  readonly parentId?: string
}

/**
 * Best-effort extraction of an optional `pageContext` object from the raw
 * request body. Returns undefined when absent or malformed — a bad
 * `pageContext` never fails the request, it just yields the un-scoped context.
 */
export const extractPageContext = (raw: unknown): ContextPageScope | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { pageContext: candidate } = raw as { readonly pageContext?: unknown }
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const { page, allowedTables: allowed } = candidate as {
    readonly page?: unknown
    readonly allowedTables?: unknown
  }
  return {
    ...(typeof page === 'string' && { page }),
    ...(Array.isArray(allowed) &&
      allowed.every((t) => typeof t === 'string') && {
        allowedTables: allowed as ReadonlyArray<string>,
      }),
  }
}

/**
 * When `AI_PROVIDER` is entirely unset, AI is not just unconfigured but
 * absent — the chat surface does not exist, so we return 404 (consistent
 * with the rest of the API's "feature not enabled → 404" convention).
 * A *present-but-empty/invalid* `AI_PROVIDER` is a misconfiguration of an
 * intended feature and surfaces as 503 from the service layer below.
 */
export const aiDisabledResponse = (c: Context): Response | undefined => {
  const provider = process.env.AI_PROVIDER
  if (provider === undefined) {
    return notFound(c, 'AI is not enabled. Set AI_PROVIDER to enable AI features.')
  }
  return undefined
}

/**
 * Run the per-user chat rate-limit gate for one request (the AI chat rate requirement-*).
 *
 * Keyed by the acting user's id so different users have independent counters
 * A no-op unless `AI_CHAT_RATE_LIMIT` is set, so the
 * rest of the chat specs (which never set it) are unaffected. Returns a 429
 * `Response` (with `Retry-After`) when the request must be rejected, or the
 * limiter decision when the request may proceed — the decision carries the
 * remaining quota surfaced as `X-RateLimit-Remaining` on the 200 response.
 */
export const applyChatRateLimit = (
  c: Context
): { readonly rejected: Response } | { readonly decision: ChatRateLimitDecision } => {
  const session = getSessionContext(c)
  const principalKey = session?.userId ?? 'anonymous'
  const decision = checkChatRateLimit(principalKey)
  return decision.limited ? { rejected: rateLimitedResponse(c, decision.retryAfter) } : { decision }
}
