/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The text-message half of a signer's codes.
 *
 * - **Email first.** In a flow that verifies both channels, a text message is
 *   sent only to a signer who has answered her email code: either before, or
 *   in the request asking for the text message (`challengeId` and `code`).
 *   That answer counts toward her tries like any other, and once right it is
 *   consumed with its `challenge-verified` event, so a link forwarded with
 *   its mailbox never reaches her phone.
 * - **The message.** The code goes to the phone the send froze for her,
 *   through the connection `verify.sms.connection` names, by the engine's own
 *   `SmsSender`, never an automation: the code lands in no run, no log and no
 *   answer. A provider that refuses or fails (its budget spent, an outage) is
 *   answered `SMS_UNAVAILABLE`; nothing is written to the chain for it, the
 *   request stays open, and she may ask again once the cooldown has passed.
 */

import { Effect } from 'effect'
import { SignatureChallengeRepository } from '@/application/ports/repositories/signatures/signature-challenge-repository'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { SmsSender, type SmsConnection } from '@/application/ports/services/sms-sender'
import { displayNameOf } from '@/domain/models/app/display-name-service'
import { buildEnvLookup, resolveEnvInString } from '@/domain/models/app/env-reference-service'
import { signatureCodeText } from '@/domain/models/app/signatures/signature-challenge-service'
import { checkCodeAnswer, type SigningCodeAnswer } from './challenge-verify'
import { SigningRefusal } from './signing-refusal'
import type { SignatureFlowOf } from './signature-request-effects'
import type { SigningSession } from '@/application/ports/repositories/signatures/signature-request-repository'
import type { App } from '@/domain/models/app'

/** Where Twilio's API answers when a connection names no `baseUrl`. */
const TWILIO_API_ROOT = 'https://api.twilio.com'

const VERIFY_EMAIL_FIRST = 'Verify the code sent by email first'

const SMS_UNAVAILABLE = 'The text message could not be sent: ask again in a minute'

/** A declared connection, as this road reads it. */
interface LooseConnection {
  readonly name: string
  readonly type: string
  readonly provider?: string | undefined
  readonly baseUrl?: string | undefined
  readonly props?: Readonly<Record<string, unknown>> | undefined
}

/**
 * The connection `name` resolved for sending: its `$env` references read, the
 * provider's default address when it names none. `undefined` for a connection
 * that is not a basic one.
 */
export const smsConnectionOf = (
  app: App,
  name: string,
  processEnv: Readonly<Record<string, string | undefined>>
): SmsConnection | undefined => {
  const connection = ((app.connections ?? []) as readonly LooseConnection[]).find(
    (candidate) => candidate.name === name
  )
  if (connection?.type !== 'basic') return undefined
  const lookup = buildEnvLookup(app.env, processEnv)
  const read = (value: unknown): string =>
    typeof value === 'string' ? resolveEnvInString(value, lookup).trim() : ''
  const baseUrl = read(connection.baseUrl)
  return {
    provider: 'twilio',
    baseUrl: baseUrl === '' ? TWILIO_API_ROOT : baseUrl,
    username: read(connection.props?.['username']),
    password: read(connection.props?.['password']),
  }
}

/**
 * Refuse a text message to a signer of a flow verifying both channels until
 * her email code is verified; verify and consume it when the request carries it.
 */
export const requireEmailVerifiedFirst = Effect.fn('signatures.require-email-first')(
  function* (input: {
    readonly session: SigningSession
    readonly flow: SignatureFlowOf
    readonly answer: SigningCodeAnswer
    readonly now: { readonly ms: number; readonly iso: string }
  }) {
    const { session, answer, now } = input
    if (input.flow.verify?.email !== true) return
    const challenges = yield* SignatureChallengeRepository
    const documentHash = session.request.documentHash ?? ''
    if (
      yield* challenges.hasVerified({ signerId: session.signerId, channel: 'email', documentHash })
    ) {
      return
    }
    if (answer === undefined) {
      return yield* new SigningRefusal({
        code: 'VERIFICATION_REQUIRED',
        message: VERIFY_EMAIL_FIRST,
      })
    }
    if (answer === 'malformed') {
      return yield* new SigningRefusal({
        code: 'CODE_INVALID',
        message: 'The code is not valid: check it, or ask for a new one',
      })
    }
    const verified = yield* checkCodeAnswer({ session, answer, channel: 'email', nowMs: now.ms })
    // A racing request that consumed it first verified her just the same.
    yield* challenges.consumeVerified({
      ...{ challengeId: verified.challengeId, requestId: session.request.id, nowMs: now.ms },
      event: {
        ...{ type: 'challenge-verified', at: now.iso, signer: session.signerName },
        data: { challengeId: verified.challengeId, channel: 'email' },
      },
    })
  }
)

/** Text `code` to `phone` through the flow's connection; a failed send is `SMS_UNAVAILABLE`. */
export const textSigningCode = Effect.fn('signatures.text-code')(function* (input: {
  readonly app: App
  readonly flow: SignatureFlowOf
  readonly phone: string
  readonly code: string
  readonly signer: string
}) {
  const sms = input.flow.verify?.sms
  const unavailable = new SigningRefusal({ code: 'SMS_UNAVAILABLE', message: SMS_UNAVAILABLE })
  if (sms === undefined) return yield* unavailable
  const env = yield* ProcessEnv
  const connection = smsConnectionOf(input.app, sms.connection, env)
  if (connection === undefined) {
    yield* Effect.logError(`The connection "${sms.connection}" cannot send text messages`)
    return yield* unavailable
  }
  const from =
    sms.from === undefined
      ? undefined
      : resolveEnvInString(sms.from, buildEnvLookup(input.app.env, env)).trim()
  yield* (yield* SmsSender)
    .send(connection, {
      ...{ to: input.phone, from },
      body: signatureCodeText({ appName: displayNameOf(input.app), code: input.code }),
    })
    .pipe(
      // The code is never logged: only who could not be reached, and the provider's answer.
      Effect.tapError((error) =>
        Effect.logError(
          `The signing code of ${input.signer} could not be texted (${error.reason}: ${error.message})`
        )
      ),
      Effect.mapError(() => unavailable)
    )
})
