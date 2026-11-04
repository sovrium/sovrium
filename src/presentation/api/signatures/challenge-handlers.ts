/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The guards of the token roads, and the code a signer asks for.
 *
 * - `POST /api/signatures/challenge` — the session's signer asks for a
 *   one-time code (`{ channel }`); the code goes to the address or phone
 *   frozen on the request, never to one the body names, and the answer shows
 *   it masked. Budgets refuse with their contract code; a text message the
 *   provider could not take is `SMS_UNAVAILABLE` (503). In a flow verifying
 *   both channels, a text-message request carries her email code
 *   (`challengeId`, `code`) until that code is verified.
 * - The cross-site guard of the signing routes: a code request, a signature
 *   or a decline posted from another site is refused 403 on every posture,
 *   a loopback development server included, since the signing cookie is the
 *   only proof those routes ask for.
 * - The link road's lockout: twenty links that lead nowhere from one network
 *   address in an hour, and every link opened from that address answers the
 *   same not-found for the rest of the hour, a valid one included.
 */

import { Effect } from 'effect'
import {
  issueSignatureChallenge,
  type ChallengeIssueInput,
} from '@/application/use-cases/signatures/challenge-issue'
import {
  countInvalidSigningLink,
  isSigningLinkRoadClosed,
} from '@/application/use-cases/signatures/challenge-link-road'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  challengeRequestSchema,
  challengeResponseSchema,
  type ChallengeRequest,
} from '@/domain/models/api/signatures/challenge'
import { logRequestPathAs } from '@/infrastructure/logging/request-log-path'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { isCrossSite } from '@/presentation/api/middleware/cross-site-request-guard'
import { signingSessionOf } from '@/presentation/api/middleware/signing-session'
import { forbidden } from '@/presentation/api/runtime/auth-helpers'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import { runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { failureResponse, signingNotFound } from './signing-session-handlers'
import type { App } from '@/domain/models/app'
import type { Context, MiddlewareHandler, Next } from 'hono'

/** Refuse a signing-session write another site sent, whatever the posture. */
export const signingCrossSiteGuard: MiddlewareHandler = async (c, next) =>
  c.req.method !== 'GET' && c.req.method !== 'HEAD' && isCrossSite(c, [])
    ? forbidden(c, 'Cross-site request refused')
    : next()

const malformed = (c: Context): Response =>
  c.json(
    {
      success: false,
      code: ApiErrorCode.VALIDATION_ERROR,
      message: 'Name the channel to send a code by',
    },
    400
  )

/** The email code a text-message request carries: none, both halves, or malformed. */
const emailAnswerOf = (body: ChallengeRequest): ChallengeIssueInput['emailAnswer'] => {
  if (body.challengeId === undefined && body.code === undefined) return undefined
  return body.challengeId === undefined || body.code === undefined
    ? 'malformed'
    : { challengeId: body.challengeId, code: body.code }
}

const challengeResponse = (c: Context, app: App, body: ChallengeRequest) =>
  issueSignatureChallenge({
    ...{ app, token: undefined, signerId: signingSessionOf(c) ?? '', channel: body.channel },
    address: getRequestRateLimitKey(c),
    emailAnswer: emailAnswerOf(body),
  }).pipe(
    Effect.match({
      onFailure: (error) => failureResponse(c, error),
      onSuccess: (answer) => shapedJson(c, answer, challengeResponseSchema),
    })
  )

/** `POST /api/signatures/challenge`. */
export async function handleChallenge(c: Context, app: App): Promise<Response> {
  // No signing session, nothing to read: the one not-found answer.
  if (signingSessionOf(c) === undefined) return signingNotFound(c)
  const { decoded } = await decodeJsonBody(c, challengeRequestSchema)
  if (!decoded.success) return malformed(c)
  return runHandlerEffect(c, challengeResponse(c, app, decoded.data))
}

/**
 * The link road's lockout, ahead of the signing page's gate: an address the
 * road is closed to gets the one not-found body before its link is even
 * read, and each link the gate answers not-found counts against its address.
 * The link's path is logged as the page's template, never with its token.
 * A budget that cannot be read or written is logged and lets the gate decide.
 */
export const signingLinkRoadLockout =
  (app: App, pagePath: string) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    // The token is a credential: every log names this request by its page's template.
    logRequestPathAs(c.req.raw, pagePath)
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
    const address = getRequestRateLimitKey(c)
    const check = await runHandlerEffect(
      c,
      isSigningLinkRoadClosed(address).pipe(
        Effect.tapCause((cause) =>
          Effect.logError('The link road budget could not be read', cause)
        ),
        // effect-swallow: the gate below still refuses every link that cannot act.
        Effect.catchCause(() => Effect.succeed(false)),
        Effect.map((isClosed) =>
          isClosed ? signingNotFound(c, app) : new Response(null, { status: 204 })
        )
      )
    )
    if (check.status !== 204) return check
    await next()
    if (c.res.status !== 404) return undefined
    await runHandlerEffect(
      c,
      countInvalidSigningLink(address).pipe(
        Effect.tapCause((cause) =>
          Effect.logError('A link that led nowhere could not be counted', cause)
        ),
        // effect-swallow: the not-found is already the answer; a lost count only delays the lockout.
        Effect.ignoreCause,
        Effect.as(new Response(null, { status: 204 }))
      )
    )
    return undefined
  }
