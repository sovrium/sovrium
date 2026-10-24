/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  EmailDeliverabilityRepository,
  type EmailSuppressionReason,
} from '@/application/ports/repositories/automations/email-deliverability-repository'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler } from './shared'

/** One address, nothing else: no list, no display name, no spaces. */
const SINGLE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/

const REASONS: ReadonlySet<string> = new Set(['bounce', 'complaint', 'unsubscribe'])

/** A database failure as the step's failure, never its cause (it may name the address). */
const ledgerFailure = (operation: string) => () =>
  Effect.succeed({
    status: 'failure' as const,
    error: `${operation} could not reach the suppression list`,
  })

/**
 * `email/suppress` — add an address to the suppression list, for one category
 * or (without `category`) every one. A `messageId` naming a message a bulk
 * send sent counts the bounce or complaint under its campaign. Only a signed
 * webhook may run it (`validate` refuses it behind an unsigned webhook or a
 * form).
 */
export const handleEmailSuppress: ActionHandler = (action) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const address = stringProp(props, 'address').trim()
    if (!SINGLE_ADDRESS.test(address)) {
      return { status: 'failure', error: 'email.suppress needs exactly one address' } as const
    }
    const reason = stringProp(props, 'reason')
    if (!REASONS.has(reason)) {
      return { status: 'failure', error: `email.suppress reason "${reason}" is unknown` } as const
    }
    const category = stringProp(props, 'category')
    const messageId = stringProp(props, 'messageId').trim()
    const repo = yield* EmailDeliverabilityRepository
    yield* repo.suppress({
      address,
      reason: reason as EmailSuppressionReason,
      ...(category === '' ? {} : { category }),
    })
    if (messageId !== '' && reason !== 'unsubscribe') {
      yield* repo.markReported({ messageId, reason: reason as 'bounce' | 'complaint' })
    }
    return {
      status: 'success',
      output: { suppressed: true, reason, category: category === '' ? null : category },
    } as const
  }).pipe(
    Effect.catchTag('EmailDeliverabilityDatabaseError', ledgerFailure('email.suppress')),
    Effect.withSpan('automations.handle-email-suppress', { attributes: actionAttributes(action) })
  )

/**
 * `email/stats` — the counts of the messages a campaign and/or a category
 * sent: `{ sent, opened, bounced, complained, unsubscribed }`. A skipped
 * recipient was never sent, so is not counted.
 */
export const handleEmailStats: ActionHandler = (action) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const campaign = stringProp(props, 'campaign')
    const category = stringProp(props, 'category')
    if (campaign === '' && category === '') {
      return {
        status: 'failure',
        error: 'email.stats needs `campaign`, `category` or both',
      } as const
    }
    const repo = yield* EmailDeliverabilityRepository
    const counts = yield* repo.countMessages({
      ...(campaign === '' ? {} : { campaign }),
      ...(category === '' ? {} : { category }),
    })
    return { status: 'success', output: { ...counts } } as const
  }).pipe(
    Effect.catchTag('EmailDeliverabilityDatabaseError', ledgerFailure('email.stats')),
    Effect.withSpan('automations.handle-email-stats', { attributes: actionAttributes(action) })
  )
