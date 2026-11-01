/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { APIError, getSessionFromCtx } from 'better-auth/api'
import type { AuthMiddlewareCtx } from './hook-context'

/** The self-service door that moves an account to another address. */
const CHANGE_EMAIL_PATH = '/change-email'

/**
 * Refuse to start an email change from a session that is not fresh.
 *
 * Moving the account's address hands whoever controls the new one every
 * password reset that follows, so it asks what adding a passkey asks: a
 * recent sign-in. "Recent" is Better Auth's own fresh-session window
 * (`session.freshAge`, a day unless configured, `0` turning the check off),
 * the one its `freshSessionMiddleware` applies, and the refusal is that
 * middleware's 403 `SESSION_NOT_FRESH`. A request with no session is left to
 * the endpoint, which answers it as it always did.
 */
export async function applyChangeEmailFreshSessionGuard(ctx: AuthMiddlewareCtx): Promise<void> {
  if (ctx.path !== CHANGE_EMAIL_PATH) return
  const { freshAge } = ctx.context.sessionConfig
  if (freshAge === 0) return
  const session = await getSessionFromCtx(ctx, { disableRefresh: true })
  if (!session?.session) return
  const createdAt = new Date(session.session.createdAt).getTime()
  if (Date.now() - createdAt < freshAge * 1000) return
  throw APIError.from('FORBIDDEN', { message: 'Session is not fresh', code: 'SESSION_NOT_FRESH' })
}
