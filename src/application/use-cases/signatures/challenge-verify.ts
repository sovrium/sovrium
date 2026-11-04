/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The code a signature carries, checked before anything is written.
 *
 * A flow that declares `verify` signs only with the code of a challenge
 * issued to this signer, for this document, still within its ten minutes and
 * never used. Every code compared counts toward her tries before it is
 * compared, durably, so neither a restart nor a burst of parallel posts
 * widens the limit; the answer to a wrong code never says how many tries are
 * left. A right code is consumed with the signature, in its transaction.
 */

import { Data, Effect } from 'effect'
import {
  SignatureChallengeRepository,
  type SignatureCodeChannel,
} from '@/application/ports/repositories/signatures/signature-challenge-repository'
import { ProcessEnv } from '@/application/ports/services/process-env'
import {
  challengeOpenToTry,
  isSignatureCodeShaped,
  signatureCodeMatches,
  tryOutcome,
} from '@/domain/models/app/signatures/signature-challenge-service'
import { parseSignatureEnv } from '@/domain/models/process-env/signatures'
import { SigningRefusal } from './signing-refusal'
import type { SignatureFlowOf } from './signature-request-effects'
import type { SigningSession } from '@/application/ports/repositories/signatures/signature-request-repository'

/** The code a signature carries: a challenge and its code, or something that cannot be one. */
export type SigningCodeAnswer =
  { readonly challengeId: string; readonly code: string } | 'malformed' | undefined

/** A code that verified the signer: the challenge to consume with her signature. */
export interface VerifiedChallenge {
  readonly challengeId: string
  readonly channel: SignatureCodeChannel
}

/** The server holds no code secret: a boot with a verifying flow refuses this, so it is a fault. */
export class SigningCodeSecretMissing extends Data.TaggedError('SigningCodeSecretMissing')<{
  readonly message: string
}> {}

/** The deployment's code secret, read from the environment. */
export const signingCodeSecret = Effect.gen(function* () {
  const parsed = parseSignatureEnv(yield* ProcessEnv)
  const secret = parsed.ok ? parsed.config.otpSecret : undefined
  if (secret === undefined) {
    return yield* new SigningCodeSecretMissing({ message: 'SIGNATURE_OTP_SECRET is not set' })
  }
  return secret
}).pipe(Effect.withSpan('signatures.code-secret'))

const refuse = (code: SigningRefusal['code'], message: string) =>
  Effect.fail(new SigningRefusal({ code, message }))

const INVALID = 'The code is not valid: check it, or ask for a new one'

/** The challenge an answer names, checked open to a try for this signer, document and channel. */
const openChallenge = (
  session: SigningSession,
  answer: { readonly challengeId: string; readonly code: string },
  input: { readonly channel: SignatureCodeChannel; readonly nowMs: number }
) =>
  Effect.gen(function* () {
    if (!isSignatureCodeShaped(answer.code)) return yield* refuse('CODE_INVALID', INVALID)
    const challenge = yield* (yield* SignatureChallengeRepository).find(answer.challengeId)
    const open = challengeOpenToTry({
      ...{ challenge, signerId: session.signerId, nowMs: input.nowMs },
      documentHash: session.request.documentHash ?? '',
    })
    if (open === 'CODE_EXPIRED') {
      return yield* refuse('CODE_EXPIRED', 'The code has expired: ask for a new one')
    }
    if (open === 'CODE_INVALID' || challenge === undefined || challenge.channel !== input.channel) {
      return yield* refuse('CODE_INVALID', INVALID)
    }
    return challenge
  })

/**
 * Check one answer against a code of `channel`: its try counted first, then
 * compared. The verified challenge, or the refusal.
 */
export const checkCodeAnswer = Effect.fn('signatures.check-code-answer')(function* (input: {
  readonly session: SigningSession
  readonly answer: { readonly challengeId: string; readonly code: string }
  readonly channel: SignatureCodeChannel
  readonly nowMs: number
}) {
  const { session, answer } = input
  const challenge = yield* openChallenge(session, answer, input)
  const attemptsWithThisOne = yield* (yield* SignatureChallengeRepository).countTry({
    ...{ challengeId: challenge.id, signerId: session.signerId },
    channel: challenge.channel,
  })
  const matches = signatureCodeMatches(
    yield* signingCodeSecret,
    {
      ...{ requestId: session.request.id, signerId: session.signerId },
      ...{ challengeId: challenge.id, code: answer.code },
    },
    challenge.codeHmac
  )
  const outcome = tryOutcome({ attemptsWithThisOne, matches })
  if (outcome === 'verified') {
    return { challengeId: challenge.id, channel: challenge.channel } satisfies VerifiedChallenge
  }
  return yield* outcome === 'TOO_MANY_CODE_ATTEMPTS'
    ? refuse(outcome, 'Too many wrong codes: this signature can no longer be verified')
    : refuse(outcome, INVALID)
})

/** Refuse a signer of a flow verifying both channels whose email code was never verified. */
const emailVerifiedBefore = (session: SigningSession) =>
  Effect.gen(function* () {
    const emailVerified = yield* (yield* SignatureChallengeRepository).hasVerified({
      ...{ signerId: session.signerId, channel: 'email' },
      documentHash: session.request.documentHash ?? '',
    })
    if (!emailVerified) {
      return yield* refuse('VERIFICATION_REQUIRED', 'Verify the code sent by email first')
    }
  })

/**
 * The challenge a signature's code verifies, `undefined` when the flow asks
 * for no code, or the refusal. A flow declaring both channels signs with the
 * text-message code, and only once her email code was verified, which she
 * did to receive it (`challenge-issue.ts`).
 */
export const verifySigningCode = Effect.fn('signatures.verify-code')(function* (input: {
  readonly session: SigningSession
  readonly flow: SignatureFlowOf
  readonly answer: SigningCodeAnswer
  readonly nowMs: number
}) {
  const { session, flow, answer } = input
  if (flow.verify?.email !== true && flow.verify?.sms === undefined) return undefined
  const channel = flow.verify.sms === undefined ? 'email' : 'sms'
  if (answer === undefined) {
    return yield* refuse('VERIFICATION_REQUIRED', 'Verify the code you received before signing')
  }
  if (answer === 'malformed') return yield* refuse('CODE_INVALID', INVALID)
  if (channel === 'sms' && flow.verify.email === true) yield* emailVerifiedBefore(session)
  return yield* checkCodeAnswer({ session, answer, channel, nowMs: input.nowMs })
})
