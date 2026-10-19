/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getCookie } from 'hono/cookie'
import { phraseFieldRefusal } from '@/application/use-cases/admin/field-refusal-words'
import { LANGUAGE_PREFERENCE_COOKIE } from '@/domain/models/app/languages/language-detection'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
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
export const respondToInviteFailure = async (
  c: Context,
  result: { readonly status: string; readonly message: string },
  actorUserId: string
): Promise<Response> => {
  if (result.status === 'invalid-input') {
    return c.json({ success: false, message: result.message, code: 'BAD_REQUEST' }, 400)
  }
  if (result.status === 'already-onboarded') {
    const preferredLanguage = getCookie(c, LANGUAGE_PREFERENCE_COOKIE)
    const errors = await runDomainPromise(
      c,
      phraseFieldRefusal('EMAIL_ALREADY_REGISTERED', {
        actorUserId,
        ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
      })
    )
    const code = 'EMAIL_ALREADY_REGISTERED'
    return c.json({ success: false, message: result.message, code, errors }, 422)
  }
  return c.json({ success: false, message: result.message, code: 'INTERNAL_ERROR' }, 500)
}
