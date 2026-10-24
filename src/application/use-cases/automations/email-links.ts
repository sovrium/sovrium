/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  EmailDeliverabilityRepository,
  type EmailDeliverabilityDatabaseError,
} from '@/application/ports/repositories/automations/email-deliverability-repository'
import { EmailLinkTokens } from '@/application/ports/services/email-link-tokens'

/** Whether an unsubscribe link's token is one this server sealed and has not expired. */
export const isValidUnsubscribeToken = (
  token: string
): Effect.Effect<boolean, never, EmailLinkTokens> =>
  Effect.gen(function* () {
    const tokens = yield* EmailLinkTokens
    return tokens.openUnsubscribe(token) !== undefined
  }).pipe(Effect.withSpan('email.check-unsubscribe-token'))

/**
 * Follow a one-click unsubscribe: the recipient the token names leaves the
 * category it names, and the message it came in counts one unsubscribe.
 * `false` for a token that was altered, forged or expired: nothing changes.
 */
export const unsubscribeByToken = (
  token: string
): Effect.Effect<
  boolean,
  EmailDeliverabilityDatabaseError,
  EmailLinkTokens | EmailDeliverabilityRepository
> =>
  Effect.gen(function* () {
    const claims = (yield* EmailLinkTokens).openUnsubscribe(token)
    if (claims === undefined) return false
    const repo = yield* EmailDeliverabilityRepository
    yield* repo.suppress({
      address: claims.address,
      reason: 'unsubscribe',
      category: claims.category,
    })
    yield* repo.markUnsubscribed(claims.ref)
    return true
  }).pipe(Effect.withSpan('email.unsubscribe-by-token'))

/**
 * Count the first open of the message an open token names. An unknown token
 * counts nothing; either way the caller answers the same image.
 */
export const recordOpenByToken = (
  token: string
): Effect.Effect<
  void,
  EmailDeliverabilityDatabaseError,
  EmailLinkTokens | EmailDeliverabilityRepository
> =>
  Effect.gen(function* () {
    const ref = (yield* EmailLinkTokens).openOpen(token)
    if (ref === undefined) return
    yield* (yield* EmailDeliverabilityRepository).markOpened(ref)
  }).pipe(Effect.withSpan('email.record-open-by-token'))
