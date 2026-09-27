/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The anonymous AI limit: a ceiling on what an unauthenticated caller may ask
 * of the operator's language model and speech engine.
 *
 * It applies ONLY to an app that declares no `auth`. With `auth`, an anonymous
 * caller never reaches the model at all — the transcription route answers 404
 * and the chat routes 401 first — so a second, anonymous-only limit would count
 * nothing. Without `auth`, every caller is anonymous and, unlike the per-user
 * `AI_CHAT_RATE_LIMIT` (off unless the operator sets it), this limit is ON by
 * default: an app with no sign-in is an app whose AI is open to the internet,
 * and the operator pays for every token and every second of GPU.
 *
 * Keyed by client address, and counted per SURFACE (`chat`, `transcriptions`)
 * so a kiosk that dictates and then sends does not spend its budget twice.
 *
 * Env (both optional, read on every request so a per-boot override is honoured):
 *  - `AI_ANON_RATE_LIMIT`   requests per window, per client address (default 10)
 *  - `AI_ANON_RATE_WINDOW`  window length in SECONDS, the unit of
 *                           `AI_CHAT_RATE_WINDOW` (default 60)
 *
 * The state is created by {@link createAiAnonRateLimit}, once per route chain,
 * rather than at module level: `serverMode: 'inprocess'` boots many servers in
 * one process, and a module-level window would let one boot's traffic count
 * against the next.
 */

import { parsePositiveIntEnv } from '@/domain/models/process-env/positive-int-env'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Default anonymous requests allowed per window, per client address. */
const DEFAULT_ANON_LIMIT = 10

/** Default window length, in seconds. */
const DEFAULT_ANON_WINDOW_SECONDS = 60

/** The AI surfaces the limit counts separately. */
export type AiAnonSurface = 'chat' | 'transcriptions'

/** Refuse the caller with a 429, or `undefined` when it may go on. */
export type AiAnonRateLimit = (
  c: Context,
  app: App | undefined,
  surface: AiAnonSurface
) => Response | undefined

/**
 * A fresh anonymous limiter with its own window state. A refused request is
 * NOT recorded, so sustained traffic does not keep pushing the window forward.
 */
export const createAiAnonRateLimit = (): AiAnonRateLimit => {
  const limiter = createSlidingWindowLimiter()
  return (c, app, surface) => {
    if (app?.auth !== undefined) return undefined
    const maxRequests = parsePositiveIntEnv(process.env['AI_ANON_RATE_LIMIT']) ?? DEFAULT_ANON_LIMIT
    const windowMs =
      (parsePositiveIntEnv(process.env['AI_ANON_RATE_WINDOW']) ?? DEFAULT_ANON_WINDOW_SECONDS) *
      1000
    const { limited, retryAfter } = limiter.consume(`${surface}:${getRequestClientIp(c)}`, {
      windowMs,
      maxRequests,
    })
    return limited ? rateLimitedResponse(c, retryAfter) : undefined
  }
}
