/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI chat error-handling helpers — `POST /api/ai/chat`.
 *
 * Drives `[internal ref]`
 * ([internal ref] — AI Provider Failure Recovery).
 *
 * Responsibilities:
 *  - Map the `AiService` tagged-error union (plus a synthetic timeout marker)
 *    onto HTTP status codes the chat route returns: provider 503 → 503,
 *    timeout → 504, every other provider failure → 502, config error → 503.
 *  - Produce user-friendly error strings: the raw provider message (which can
 *    embed stack-trace fragments or internal class names like
 *    `InternalServerError`) is never forwarded to the caller. Instead a fixed,
 *    human-readable sentence keyed by the resolved HTTP status is returned.
 *  - Read the operator-tunable error-handling env vars
 *    (`AI_CHAT_TIMEOUT`, `AI_CHAT_MAX_MESSAGE_LENGTH`, `AI_CHAT_MAX_RETRIES`)
 *    with frugal, conservative defaults.
 *
 * Env-var contract (all optional, operator-controlled):
 *  - `AI_CHAT_TIMEOUT`            ms budget for one provider call. Unset → no
 *                                 timeout. A call exceeding the budget yields
 *                                 a 504.
 *  - `AI_CHAT_MAX_MESSAGE_LENGTH` max user-message character count. Unset → no
 *                                 limit. An over-length message yields a 400.
 *  - `AI_CHAT_MAX_RETRIES`        max retry attempts for transient (503/429)
 *                                 provider failures. Unset/0 → no retry.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import type { AiError } from '@/application/ports/services/ai-service'

/** The error union the chat route maps onto HTTP statuses. */
export type ChatTurnError = AiError

/**
 * Resolve the HTTP status the chat route returns for a given chat-turn error.
 *
 *  - `AiTimeoutError`                       → 504 Gateway Timeout
 *  - `AiConfigError`                        → 503 Service Unavailable
 *  - `AiProviderError` with statusCode 503  → 503 Service Unavailable
 *  - `AiProviderError` (any other)          → 502 Bad Gateway
 */
export const chatErrorStatus = (err: ChatTurnError): 502 | 503 | 504 => {
  if (err._tag === 'AiTimeoutError') return 504
  if (err._tag === 'AiConfigError') return 503
  // AiProviderError — pass 503 through verbatim so an upstream "service
  // unavailable" is reflected to the caller; everything else is a bad gateway.
  return err.statusCode === 503 ? 503 : 502
}

/**
 * A fixed, user-friendly error sentence for the resolved HTTP status. The raw
 * provider message is intentionally discarded — it can leak stack traces or
 * internal class names — so callers always see a
 * stable, safe string carrying enough signal to retry or escalate.
 */
export const chatErrorMessage = (status: 502 | 503 | 504): string => {
  switch (status) {
    case 504:
      return 'The AI service timed out. Please try again.'
    case 503:
      return 'The AI service is temporarily unavailable. Please try again later.'
    case 502:
      return 'The AI service encountered an error. Please try again.'
  }
}

/**
 * The canonical error code for the resolved HTTP status.
 *
 * All three used to render as SERVICE_UNAVAILABLE, because the union had no
 * bad-gateway or gateway-timeout member. That flattening told a caller "the
 * service is down, wait and retry" for two conditions where it is not: a 502
 * is an upstream that answered badly, and a 504 is one that answered too
 * slowly. Only the 503 genuinely means "unavailable, come back later", and it
 * is the one that keeps the code.
 *
 * The switch is exhaustive over the same `502 | 503 | 504` union
 * {@link chatErrorStatus} produces, so widening that union without deciding
 * what the new status MEANS is a compile error rather than a silent
 * inheritance of whichever branch happened to be last.
 */
export const chatErrorCode = (status: 502 | 503 | 504): ApiErrorCode => {
  switch (status) {
    case 504:
      return ApiErrorCode.GATEWAY_TIMEOUT
    case 503:
      return ApiErrorCode.SERVICE_UNAVAILABLE
    case 502:
      return ApiErrorCode.BAD_GATEWAY
  }
}

/**
 * Parse a positive-integer env var, returning `undefined` when unset, empty,
 * or non-numeric. Zero and negatives collapse to `undefined` so callers can
 * treat "no limit" / "no retry" uniformly with the unset case.
 */
const parsePositiveIntEnv = (raw: string | undefined): number | undefined => {
  if (raw === undefined || raw.trim() === '') return undefined
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Resolved, operator-tunable chat error-handling configuration. */
export interface ChatErrorConfig {
  /** Per-call timeout budget in ms; `undefined` → no timeout. */
  readonly timeoutMs: number | undefined
  /** Max user-message length; `undefined` → no limit. */
  readonly maxMessageLength: number | undefined
  /** Max retry attempts for transient failures; `undefined` → no retry. */
  readonly maxRetries: number | undefined
}

/**
 * Read the chat error-handling env vars from `process.env`. All three are
 * optional and default to "disabled" (no timeout / no limit / no retry).
 */
export const resolveChatErrorConfig = (
  env: Readonly<Record<string, string | undefined>> = process.env
): ChatErrorConfig => ({
  timeoutMs: parsePositiveIntEnv(env.AI_CHAT_TIMEOUT),
  maxMessageLength: parsePositiveIntEnv(env.AI_CHAT_MAX_MESSAGE_LENGTH),
  maxRetries: parsePositiveIntEnv(env.AI_CHAT_MAX_RETRIES),
})

/**
 * Whether a provider error is transient and therefore worth retrying.
 *
 * Transient: HTTP 503 (service unavailable) and 429 (rate limited) — the same
 * request may well succeed on a later attempt. Non-transient: 4xx other than
 * 429 (e.g. 400 bad request, 401 unauthorized) — retrying is futile and only
 * amplifies load, so those are surfaced immediately.
 */
export const isTransientChatError = (err: ChatTurnError): boolean => {
  if (err._tag !== 'AiProviderError') return false
  return err.statusCode === 503 || err.statusCode === 429
}
