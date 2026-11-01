/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { getCookie } from 'hono/cookie'
import { phraseFieldRefusal } from '@/application/use-cases/admin/field-refusal-words'
import { LANGUAGE_PREFERENCE_COOKIE } from '@/domain/models/app/languages/language-detection'
import type { Context } from 'hono'

/**
 * Map a non-success invite-user result onto an HTTP response.
 *
 * Pre-condition: caller has confirmed `result.status !== 'invited'`. The
 * status discriminator drives the HTTP code: `invalid-input` → 400,
 * `already-onboarded` → 422 (a fully-onboarded user), everything else → 500.
 * The 422 names `email` as the field it is about, in the inviting operator's
 * console language, so the invite form draws the reason under its Email field.
 */
export const respondToInviteFailure = (
  c: Context,
  result: { readonly status: string; readonly message: string },
  actorUserId: string
) => {
  if (result.status === 'invalid-input') {
    return Effect.succeed<Response>(
      c.json({ success: false, message: result.message, code: 'BAD_REQUEST' }, 400)
    )
  }
  if (result.status === 'already-onboarded') {
    const preferredLanguage = getCookie(c, LANGUAGE_PREFERENCE_COOKIE)
    return Effect.map(
      phraseFieldRefusal('EMAIL_ALREADY_REGISTERED', {
        actorUserId,
        ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
      }),
      (errors): Response => {
        const code = 'EMAIL_ALREADY_REGISTERED'
        return c.json({ success: false, message: result.message, code, errors }, 422)
      }
    )
  }
  return Effect.succeed<Response>(
    c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)
  )
}

/**
 * Map a non-success accept-invitation result onto an HTTP response.
 *
 * Pre-condition: caller has confirmed `result.status !== 'accepted'`. The
 * result is narrowed to the failure union so each branch knows it has a
 * `message`. 410 is reserved for token expiry; everything else is 4xx
 * (client error) or 5xx (internal error).
 */
export const respondToAcceptFailure = (
  c: Context,
  result: { readonly status: string; readonly message: string }
): Response => {
  if (result.status === 'invalid-input') {
    return c.json({ success: false, message: result.message, code: 'BAD_REQUEST' }, 400)
  }
  if (result.status === 'invalid-token') {
    return c.json({ success: false, message: result.message, code: 'INVALID_TOKEN' }, 400)
  }
  if (result.status === 'expired-token') {
    return c.json({ success: false, message: result.message, code: 'TOKEN_EXPIRED' }, 410)
  }
  return c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)
}
