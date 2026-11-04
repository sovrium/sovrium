/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A signer asks for a one-time code from her signing session.
 *
 * The code goes to the address (or, by text message, the phone) the send
 * froze for her, whatever the request names: a body cannot redirect it. Each
 * channel has its own budgets; a text message goes out only once her email
 * code is verified when the flow asks for both (`sms-challenge-send.ts`). Only its HMAC is kept, bound to the
 * document she was shown; the code itself travels in the mail and nowhere
 * else (no log, no run, no answer). Nothing is appended to the evidence
 * chain yet: a code proves something only once it is answered.
 *
 * The code is admitted and recorded before it is sent, in one transaction
 * holding her request's lock (`SignatureChallengeRepository.issueWithinBudgets`):
 * codes asked for together are judged one after the other, so the cooldown
 * and the budgets let exactly one of them through, and only that one is sent.
 *
 * A code that could not be delivered (a provider outage, a mail server down)
 * does not spend one of her codes: its challenge is then marked expired at
 * birth, which her standing leaves out of what she received but still dates
 * her cooldown from. The address budget counts the request either way, so a
 * failing provider cannot be pumped.
 */

import { Effect } from 'effect'
import { SignatureChallengeRepository } from '@/application/ports/repositories/signatures/signature-challenge-repository'
import { EmailSender } from '@/application/ports/services/email-sender'
import { NotFoundError } from '@/domain/errors'
import { displayNameOf } from '@/domain/models/app/display-name-service'
import {
  codeIssueRefusal,
  maskedEmailAddress,
  maskedPhoneNumber,
  SIGNATURE_ADDRESS_WINDOW_MS,
  SIGNATURE_CODE_RESEND_COOLDOWN_MS,
  SIGNATURE_CODE_VALIDITY_MS,
  signatureCodeHmac,
  signatureCodeMail,
  signatureCodeOf,
} from '@/domain/models/app/signatures/signature-challenge-service'
import { signingCodeSecret, type SigningCodeAnswer } from './challenge-verify'
import { liveSigningSession } from './sign-signature-request'
import { nowInstant } from './signature-request-effects'
import { SigningRefusal } from './signing-refusal'
import { requireEmailVerifiedFirst, textSigningCode } from './sms-challenge-send'
import type { App } from '@/domain/models/app'

/** What a signer asks for: a code by `channel`, from network `address`. */
export interface ChallengeIssueInput {
  readonly app: App
  readonly token: string | undefined
  /** The signer a signing page's cookie names; when set, `token` is not read. */
  readonly signerId?: string | undefined
  readonly channel: 'email' | 'sms'
  readonly address: string
  /** With `sms` in a flow verifying both: her email code, verified first. */
  readonly emailAnswer?: SigningCodeAnswer
}

/** The address budget each channel counts against. */
const ADDRESS_EVENT = { email: 'code-sent', sms: 'sms-code-sent' } as const

const notFound = () => Effect.fail(new NotFoundError('Signing session not found'))

/** One six-digit code, drawn uniformly from the platform's secure generator. */
const drawCode = Effect.sync(() => {
  const [draw] = crypto.getRandomValues(new Uint32Array(1))
  // 2^32 is not a multiple of a million: the bias it leaves is below one in four thousand.
  return signatureCodeOf(draw ?? 0)
})

/** What each refused code says to the signer. */
const ISSUE_REFUSALS = {
  TOO_MANY_CODE_ATTEMPTS: 'Too many wrong codes: this signature can no longer be verified',
  RESEND_TOO_SOON: 'Wait a minute before asking for a new code',
  TOO_MANY_CODES_SENT: 'No more codes can be sent for now',
} as const

/** The session asking, checked: a live signer of a flow verifying by this channel. */
const admittedSigner = (input: ChallengeIssueInput) =>
  Effect.gen(function* () {
    const { session, flow } = yield* liveSigningSession(input.app, input.token, input.signerId)
    const offered =
      input.channel === 'email' ? flow.verify?.email === true : flow.verify?.sms !== undefined
    if (!offered) {
      return yield* new SigningRefusal({
        code: 'CHANNEL_UNAVAILABLE',
        message: 'This signature offers no code by this channel',
      })
    }
    const { documentHash } = session.request
    if (documentHash === undefined) return yield* notFound()
    const now = yield* nowInstant
    if (input.channel === 'sms') {
      yield* requireEmailVerifiedFirst({ session, flow, answer: input.emailAnswer, now })
    }
    return { session, flow, documentHash, now }
  })

/** Mail `code` to `destination` only; a failed send is logged without the code, and fails. */
const mailCode = (input: ChallengeIssueInput, destination: string, code: string, signer: string) =>
  Effect.gen(function* () {
    yield* (yield* EmailSender)
      .send({
        to: destination,
        fromName: displayNameOf(input.app),
        ...signatureCodeMail({ appName: displayNameOf(input.app), displayName: '', code }),
      })
      .pipe(
        Effect.tapCause(() => Effect.logError(`The signing code of ${signer} could not be mailed`))
      )
  })

/** The destination the send froze for the channel, masked as the signer is shown it. */
const destinationOf = (signerId: string, channel: ChallengeIssueInput['channel']) =>
  Effect.gen(function* () {
    const challenges = yield* SignatureChallengeRepository
    const destination =
      channel === 'email'
        ? yield* challenges.destination(signerId)
        : yield* challenges.phoneDestination(signerId)
    if (destination === undefined || destination === '') return yield* notFound()
    const hint =
      channel === 'email' ? maskedEmailAddress(destination) : maskedPhoneNumber(destination)
    return { destination, hint }
  })

/** A challenge as recorded before its code is sent. */
interface RecordedChallenge {
  readonly id: string
  readonly signerId: string
  readonly channel: ChallengeIssueInput['channel']
  readonly codeHmac: string
  readonly documentHash: string
}

/**
 * Deliver the code of a challenge already recorded, with `deliver`; when the
 * delivery fails, mark the challenge expired at birth, so a code nobody
 * received spends none of her allowance while her cooldown still runs from
 * it. The delivery's failure is kept.
 */
export const expireChallengeOnFailedDelivery = Effect.fn('signatures.deliver-recorded-challenge')(
  function* <E, R>(input: {
    readonly deliver: Effect.Effect<void, E, R>
    readonly challenge: RecordedChallenge
    readonly nowMs: number
  }) {
    const challenges = yield* SignatureChallengeRepository
    yield* input.deliver.pipe(
      Effect.tapError(() => challenges.expireAtBirth({ ...input.challenge, nowMs: input.nowMs }))
    )
  }
)

/** Admit and record a challenge under her request's lock, or fail with the refusal. */
const recordWithinBudgets = (input: {
  readonly address: string
  readonly requestId: string
  readonly challenge: RecordedChallenge
  readonly nowMs: number
}) =>
  Effect.gen(function* () {
    const { challenge, nowMs } = input
    const refused = yield* (yield* SignatureChallengeRepository).issueWithinBudgets({
      ...{ requestId: input.requestId, address: input.address, nowMs },
      event: ADDRESS_EVENT[challenge.channel],
      challenge: { ...challenge, expiresAtMs: nowMs + SIGNATURE_CODE_VALIDITY_MS },
      ...{
        sinceMs: nowMs - SIGNATURE_ADDRESS_WINDOW_MS,
        untilMs: nowMs + SIGNATURE_ADDRESS_WINDOW_MS,
      },
      refuse: ({ standing, sentFromAddress }) =>
        codeIssueRefusal({ standing, sentFromAddress, nowMs }),
    })
    if (refused !== undefined) {
      return yield* new SigningRefusal({ code: refused, message: ISSUE_REFUSALS[refused] })
    }
    return nowMs + SIGNATURE_CODE_VALIDITY_MS
  })

/** Send a code to a signer's frozen address or phone, by her session, within every budget. */
export const issueSignatureChallenge = Effect.fn('signatures.issue-challenge')(function* (
  input: ChallengeIssueInput
) {
  const { session, flow, documentHash, now } = yield* admittedSigner(input)
  const { channel } = input
  const { destination, hint } = yield* destinationOf(session.signerId, channel)
  const secret = yield* signingCodeSecret
  const challengeId = crypto.randomUUID()
  const code = yield* drawCode
  const challenge = {
    ...{ id: challengeId, signerId: session.signerId, channel, documentHash },
    codeHmac: signatureCodeHmac(secret, {
      ...{ requestId: session.request.id, signerId: session.signerId },
      ...{ challengeId, code },
    }),
  }
  const expiresAtMs = yield* recordWithinBudgets({
    ...{ address: input.address, requestId: session.request.id, challenge, nowMs: now.ms },
  })
  yield* expireChallengeOnFailedDelivery({
    deliver: Effect.gen(function* () {
      if (channel === 'email') return yield* mailCode(input, destination, code, session.signerName)
      yield* textSigningCode({
        ...{ app: input.app, flow, phone: destination, code },
        signer: session.signerName,
      })
    }),
    challenge,
    nowMs: now.ms,
  })
  return {
    ...{ challengeId, channel, destinationHint: hint },
    expiresAt: new Date(expiresAtMs).toISOString(),
    resendAfter: new Date(now.ms + SIGNATURE_CODE_RESEND_COOLDOWN_MS).toISOString(),
  }
})
