/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { classifyCommentBySpam } from '@/domain/services/comments/comment-spam-classification'
import { checkAndRecord, type RateLimitPolicy } from '@/infrastructure/forms/form-rate-limiter'
import { hashIp, readIpHashSalt } from '@/infrastructure/forms/ip-hash'
import type { App } from '@/domain/models/app'
import type {
  CommentSpamProtectionConfig,
  CommentSpamStatus,
} from '@/domain/services/comments/comment-spam-classification'
import type { Context } from 'hono'


const DEFAULT_RATE_LIMIT_PER_IP = 5
const DEFAULT_RATE_WINDOW_SECONDS = 60
const DEFAULT_RATE_LIMIT_PER_FORM = 1000

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

function extractClientIp(c: Context): string | undefined {
  const forwarded = c.req.header('x-forwarded-for')
  if (typeof forwarded === 'string' && forwarded !== '') {
    return forwarded.split(',')[0]?.trim() ?? undefined
  }
  return c.req.header('x-real-ip') ?? undefined
}

export function applyRateLimit(input: {
  readonly c: Context
  readonly table: NonNullable<App['tables']>[number]
}): Response | undefined {
  const policy = resolveRateLimitPolicy(input.table)
  if (policy === undefined) return undefined
  const ip = extractClientIp(input.c)
  const ipHash = hashIp(readIpHashSalt(), ip ?? '')
  const formName = `comments-${input.table.name}`
  const result = checkAndRecord({ ipHash, formName, policy })
  if (result.ok) return undefined
  return input.c.json({ error: 'rate limit exceeded' }, 429, {
    'Retry-After': String(result.retryAfterSec),
  })
}

export function classifySpam(
  table: NonNullable<App['tables']>[number],
  content: string
): CommentSpamStatus {
  const cfg = readCommentsConfig(table)
  const protection = cfg.spamProtection as CommentSpamProtectionConfig | undefined
  return classifyCommentBySpam(content, protection)
}
