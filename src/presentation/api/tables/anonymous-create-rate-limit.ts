/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rate limit on an ANONYMOUS record create.
 *
 * A table whose `create` permission is `all` takes records from visitors who
 * are not signed in, straight through `POST /api/tables/:table/records` — the
 * records-API twin of a public form. It is therefore limited like one: the same
 * in-process sliding windows a form submission meets
 * (`infrastructure/forms/form-rate-limiter`, `checkAndRecord`), under the
 * form defaults (`DEFAULT_ANTI_SPAM.rateLimit` — 10 per visitor address and
 * 1000 per table, per 60 seconds), keyed per table under `records:<table>` —
 * a key no form name can spell. A signed-in caller is
 * already accountable and is not limited here.
 */

import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { DEFAULT_ANTI_SPAM } from '@/domain/models/app/forms/anti-spam-defaults'
import { checkAndRecord } from '@/infrastructure/forms/form-rate-limiter'
import { hashIp, resolveIpHashSalt } from '@/infrastructure/forms/ip-hash'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import type { Context } from 'hono'

/** A 429 with `Retry-After` when an anonymous visitor has created too many records; `undefined` otherwise. */
export function limitAnonymousCreate(
  c: Context,
  userId: string,
  tableName: string
): Response | undefined {
  if (!isGuestSession(userId)) return undefined
  const ipHash = hashIp(resolveIpHashSalt(), getRequestRateLimitKey(c))
  const result = checkAndRecord({
    ipHash,
    // `:` never appears in a form name (`^[a-z][a-z0-9-]*$`), so no form shares this count.
    formName: `records:${tableName}`,
    policy: DEFAULT_ANTI_SPAM.rateLimit,
  })
  if (result.ok) return undefined
  return c.json(
    errorBody({
      error: 'rate limit exceeded',
      message: 'Too many records created — try again shortly',
      code: ApiErrorCode.RATE_LIMITED,
    }),
    429,
    { 'Retry-After': String(result.retryAfterSec) }
  )
}
