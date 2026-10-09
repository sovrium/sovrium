/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  buildEnvLookup,
  resolveSecretInString,
} from '@/application/use-cases/automations/resolve-env-vars'
import { constantTimeEqual } from '@/presentation/api/runtime/constant-time-equal'
import { webhookNotFound } from './webhook-refusals'
import type { App } from '@/domain/models/app'
import type { Trigger } from '@/domain/models/app/automations/trigger'
import type { Context } from 'hono'

type WebhookTrigger = Extract<Trigger, { type: 'webhook' }>

/** A challenge longer than this is not a provider's: it is not echoed. */
const MAX_CHALLENGE_LENGTH = 512

/** Whether the handshake presents the configured verify token (constant time). */
const presentsToken = (c: Context, expected: string): boolean =>
  expected !== '' && constantTimeEqual(c.req.query('hub.verify_token') ?? '', expected)

const isEchoable = (challenge: string): boolean =>
  challenge !== '' && challenge.length <= MAX_CHALLENGE_LENGTH

/**
 * Answer a provider's subscription handshake, when the trigger declares one.
 *
 * Meta (Facebook Pages, Lead Ads, Instagram, WhatsApp Cloud) subscribes a
 * webhook with a GET carrying `hub.mode=subscribe`, `hub.verify_token` and
 * `hub.challenge`, and delivers events only to an endpoint that answers the
 * challenge back, verbatim, as plain text. The handshake runs BEFORE the
 * method gate and authentication and creates no run: the verify token is its
 * only credential, compared in constant time. A wrong token, another mode, a
 * missing or oversized challenge are all answered with the same 404 as a
 * webhook that does not exist — echoing nothing, confirming nothing.
 *
 * Returns `undefined` when the request is not a handshake to answer here: the
 * trigger declares none, or it is not a GET, or GET is itself an accepted event
 * method and the request carries no `hub.mode`.
 */
export const answerVerificationHandshake = (
  c: Context,
  app: App,
  trigger: WebhookTrigger,
  getIsEventMethod: boolean
): Response | undefined => {
  const { verification } = trigger
  if (verification === undefined || c.req.method.toUpperCase() !== 'GET') return undefined
  const mode = c.req.query('hub.mode')
  if (mode === undefined && getIsEventMethod) return undefined
  const expected = resolveSecretInString(
    verification.verifyToken,
    buildEnvLookup(app.env, process.env)
  )
  const challenge = c.req.query('hub.challenge') ?? ''
  const valid = mode === 'subscribe' && presentsToken(c, expected) && isEchoable(challenge)
  if (!valid) return webhookNotFound(c)
  return c.text(challenge, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  })
}
