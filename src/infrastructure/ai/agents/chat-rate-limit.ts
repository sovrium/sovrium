/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Per-user AI chat rate limiter (in-memory sliding window).
 *
 * Drives `[internal ref]`
 * (the AI chat rate limiting requirement — Chat Rate Limiting).
 *
 * A burst of rapid `POST /api/ai/chat` calls from a single user must
 * eventually produce HTTP 429. Built on the shared
 * `createSlidingWindowLimiter()` primitive (see
 * `@/infrastructure/process/sliding-window-limiter`) — a process-local Map of
 * recent timestamps keyed by the acting principal. The same caveat applies —
 * suitable only for single-process deployments, which is exactly the E2E
 * test topology (one server process per test).
 *
 * Operator-tunable env-var contract (both optional):
 *  - `AI_CHAT_RATE_LIMIT`  max messages allowed within the window. A positive
 *                          number wins; `0` disables limiting. Unset, it is
 *                          60 for a signed-in user's chat when `AI_PROVIDER`
 *                          names a hosted provider, and disabled otherwise.
 *  - `AI_CHAT_RATE_WINDOW` sliding-window length in seconds. Unset → defaults
 *                          to 60 seconds.
 *
 * The hosted-provider default reaches every surface a PERSON spends AI through:
 * the per-user chat ({@link checkUserChatRateLimit}) and, each in its own
 * window, transcription, chat attachments and knowledge search
 * ({@link checkPersonAiRateLimit}). An agent's own budget reads
 * {@link resolveChatRateLimitConfig} and is limited only when the operator sets
 * the variable.
 */

import { resolveUserChatRateLimit } from '@/domain/models/process-env/ai/ai-chat-caps'
import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import type { LimitCheckOptions } from '@/infrastructure/ai/agents/agent-rate-limit'

const limiter = createSlidingWindowLimiter()

/** Default sliding-window length when `AI_CHAT_RATE_WINDOW` is unset. */
const DEFAULT_WINDOW_SECONDS = 60

/** Resolved, operator-tunable rate-limit configuration for the chat route. */
interface ChatRateLimitConfig {
  /** Max messages allowed within the window. `undefined` → limiting disabled. */
  readonly limit: number | undefined
  /** Sliding-window length in seconds. */
  readonly windowSeconds: number
}

/**
 * Resolve the chat rate-limit config from the environment: the explicit
 * `AI_CHAT_RATE_LIMIT` only, with no provider default. Read fresh on every call
 * so a test that sets the env vars per server boot is honoured.
 */
export const resolveChatRateLimitConfig = (): ChatRateLimitConfig => ({
  limit: parsePositiveIntEnv(process.env.AI_CHAT_RATE_LIMIT),
  windowSeconds: parsePositiveIntEnv(process.env.AI_CHAT_RATE_WINDOW) ?? DEFAULT_WINDOW_SECONDS,
})

/**
 * The per-user chat's config: as {@link resolveChatRateLimitConfig}, but an
 * unset `AI_CHAT_RATE_LIMIT` takes the hosted-provider default.
 */
const resolveUserChatRateLimitConfig = (): ChatRateLimitConfig => ({
  ...resolveChatRateLimitConfig(),
  limit: resolveUserChatRateLimit(process.env),
})

export interface ChatRateLimitDecision {
  /** True when the attempt is rate-limited and must be rejected with 429. */
  readonly limited: boolean
  /** Whole seconds until the oldest in-window timestamp falls out (429 only). */
  readonly retryAfter: number
  /** Remaining quota within the current window after this attempt. */
  readonly remaining: number
  /** Resolved per-window limit, or `undefined` when limiting is disabled. */
  readonly limit: number | undefined
}

/** `consume`'s decision, made without recording the attempt. */
const peek = (
  key: string,
  config: { readonly windowMs: number; readonly maxRequests: number }
): { readonly limited: boolean; readonly retryAfter: number; readonly count: number } => {
  const count = limiter.getRecent(key, config.windowMs).length
  return count >= config.maxRequests
    ? {
        limited: true,
        retryAfter: limiter.getRetryAfter(key, config.windowMs, { minSeconds: 1 }),
        count,
      }
    : { limited: false, retryAfter: 0, count }
}

/** The limiter decision for one principal under one resolved config. */
const decide = (
  principalKey: string,
  { limit, windowSeconds }: ChatRateLimitConfig,
  options: LimitCheckOptions
): ChatRateLimitDecision => {
  // Limiting disabled — never rate-limit, never record state.
  if (limit === undefined) {
    return { limited: false, retryAfter: 0, remaining: Number.MAX_SAFE_INTEGER, limit: undefined }
  }

  const config = { windowMs: windowSeconds * 1000, maxRequests: limit }
  const decision =
    options.record === false ? peek(principalKey, config) : limiter.consume(principalKey, config)
  return {
    limited: decision.limited,
    retryAfter: decision.retryAfter,
    remaining: decision.limited ? 0 : Math.max(0, limit - decision.count),
    limit,
  }
}

/**
 * Record a chat-message attempt for `principalKey` and decide whether it is
 * rate-limited.
 *
 * When the resolved limit is absent the limiter is a pure no-op:
 * `limited: false`, `remaining` and `limit` are `undefined`/`Infinity`-ish and
 * no state is recorded.
 *
 * When `limited` is true the attempt is NOT recorded (so the window does not
 * keep extending under sustained load) and `retryAfter` carries the number of
 * whole seconds until the oldest in-window timestamp falls out.
 */
export const checkChatRateLimit = (
  principalKey: string,
  options: LimitCheckOptions = {}
): ChatRateLimitDecision => decide(principalKey, resolveChatRateLimitConfig(), options)

/**
 * {@link checkChatRateLimit} for a signed-in user's own chat, where an unset
 * `AI_CHAT_RATE_LIMIT` caps a hosted provider at its default.
 */
export const checkUserChatRateLimit = (
  userId: string,
  options: LimitCheckOptions = {}
): ChatRateLimitDecision => decide(userId, resolveUserChatRateLimitConfig(), options)

/** The AI surfaces outside the chat that charge a person's budget, one window each. */
export type PersonAiSurface = 'transcriptions' | 'attachments' | 'knowledge-search'

/**
 * {@link checkUserChatRateLimit} for one of a person's other AI surfaces: the
 * same limit and window as their chat (the hosted-provider default included),
 * counted in a window of its own so dictating a message does not spend the
 * message it dictates. `principal` is the user id, or an anonymous caller's
 * network key.
 */
export const checkPersonAiRateLimit = (
  surface: PersonAiSurface,
  principal: string,
  options: LimitCheckOptions = {}
): ChatRateLimitDecision =>
  decide(`${surface}:${principal}`, resolveUserChatRateLimitConfig(), options)
