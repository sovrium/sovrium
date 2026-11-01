/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ApiErrorCode } from '@/domain/models/api/error'
import { checkPersonAiRateLimit } from '@/infrastructure/ai/agents/chat-rate-limit'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { rateLimitedResponse } from '@/presentation/api/runtime/rate-limit-response'
import type { Context } from 'hono'

/**
 * The 503 for a deployment with no `AI_PROVIDER` at all —
 * a clear refusal rather than a silent empty result.
 *
 * `AI_PROVIDER_NOT_CONFIGURED` is a canonical `ApiErrorCode` member. It says
 * the operator must set an env var, where SERVICE_UNAVAILABLE would say "wait
 * and retry" — advice that is never true here, and the only signal separating
 * an unconfigured deployment from an unreachable provider.
 */
const PROVIDER_NOT_CONFIGURED_MESSAGE =
  'AI provider not configured. Set AI_PROVIDER (and AI_BASE_URL / AI_API_KEY) to enable RAG search.'

export const providerNotConfigured = (c: Context): Response =>
  c.json(
    {
      success: false,
      error: PROVIDER_NOT_CONFIGURED_MESSAGE,
      message: PROVIDER_NOT_CONFIGURED_MESSAGE,
      code: ApiErrorCode.AI_PROVIDER_NOT_CONFIGURED,
    },
    503
  )

/**
 * Every search is an embedding call, so it spends the caller's AI budget as a
 * chat message does: the chat's per-person limit and window, in a window of its own.
 */
export const searchRateLimited = (c: Context): Response | undefined => {
  const principal = getSessionContext(c)?.userId ?? `ip:${getRequestRateLimitKey(c)}`
  const rate = checkPersonAiRateLimit('knowledge-search', principal)
  return rate.limited ? rateLimitedResponse(c, rate.retryAfter) : undefined
}
