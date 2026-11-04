/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a signer does from her link: open her signing session, sign, decline.
 *
 * A session is the link's token, held in a cookie once the page opened it.
 * Every way it can no longer act — a token nobody issued, a link past its
 * deadline, a signer who already signed or declined, a request that ended —
 * answers the same not-found, so a link-holder never learns which it was.
 *
 * A signature is written by the engine, never by the signer: the value stored
 * in her field is version 2, its statement the one frozen at send, its
 * document hash the frozen copy's (re-read and re-hashed before she signs, so
 * a copy changed in storage is never signed), its identity `anonymous` (the
 * link was the only proof asked). It is written through the ordinary update
 * road with its evidence in the same transaction: the signer marked signed,
 * the request moved on, the `signed` event appended, and in sequence the next
 * signer invited. The same signature posted twice answers the first one.
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import {
  SignatureRequestRepository,
  SigningSessionClosed,
  type FlowSignatureOutcome,
  type SigningSession,
} from '@/application/ports/repositories/signatures/signature-request-repository'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { updateRecordWithSideEffects } from '@/application/use-cases/tables/record-write-roads'
import { engineAuthoredSignature } from '@/application/use-cases/tables/signature-write-once-check'
import { NotFoundError, ValidationError } from '@/domain/errors'
import {
  capturedSignatureValue,
  isAcceptableSignatureImage,
  linkSignerName,
  signatureRequestEvidenceKey,
} from '@/domain/models/app/signatures/signature-capture-service'
import { sha256Hex } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import {
  isSigningSessionLive,
  MAX_SIGNATURE_DOCUMENT_BYTES,
  mayReplaySignature,
  requestStatusOf,
  signatureMarkName,
  signatureTriggerPayload,
  type RequestStatus,
  type SignatureTriggerPayload,
} from '@/domain/models/app/signatures/signature-request-service'
import { verifySigningCode, type SigningCodeAnswer } from './challenge-verify'
import { completeSignatureRequest } from './end-signature-request'
import { roadRecordWriter } from './road-record-writer'
import {
  keepUntilFor,
  mailSigningLinks,
  nowInstant,
  writeFlowStatus,
  type SignatureFlowOf,
} from './signature-request-effects'
import { SigningRefusal } from './signing-refusal'
import { sessionAndFlow } from './signing-session-key'
import type { App } from '@/domain/models/app'

export { SigningRefusal } from './signing-refusal'

/** One move of a request a route reports to the signature triggers. */
export interface SignatureMove {
  readonly flow: SignatureFlowOf
  readonly recordId: string
  readonly trigger: SignatureTriggerPayload
}

/** What a signature answers, and the moves it made. */
export interface SignedAnswer {
  readonly evidenceId: string
  readonly signedAt: string
  readonly status: RequestStatus
  readonly moves: readonly SignatureMove[]
}

/** The uniform answer for every session that cannot act. */
const notFound = () => Effect.fail(new NotFoundError('Signing session not found'))

const stateOf = (session: SigningSession) => ({
  requestStatus: session.request.status,
  signerStatus: session.signerStatus,
  tokenExpiresAt: session.tokenExpiresAt,
  requestExpiresAt: session.request.expiresAt,
})

/** The session a token opens while it may still sign or decline, else not found. */
export const liveSigningSession = Effect.fn('signatures.live-signing-session')(function* (
  app: App,
  token: string | undefined,
  signerId?: string | undefined
) {
  const found = yield* sessionAndFlow(app, token, signerId)
  const now = yield* nowInstant
  return isSigningSessionLive(stateOf(found.session), now.ms) ? found : yield* notFound()
})

/** The signature a signer already gave, answered again; not found once her request ended otherwise. */
const replayedSignature = (session: SigningSession) =>
  Effect.gen(function* () {
    const requests = yield* SignatureRequestRepository
    const current = yield* requests.read(session.request.id)
    if (
      current === undefined ||
      !mayReplaySignature({
        ...stateOf(session),
        signerStatus: 'signed',
        requestStatus: current.status,
      })
    ) {
      return yield* notFound()
    }
    const chain = yield* (yield* SignatureEvidenceRepository).readChain(session.request.id)
    const signed = chain.find(
      (event) => event.type === 'signed' && event.signer === session.signerName
    )
    const evidenceId = signed?.data['evidenceId']
    if (signed === undefined || typeof evidenceId !== 'string') return yield* notFound()
    return { evidenceId, signedAt: signed.at, status: requestStatusOf(current.status), moves: [] }
  })

/** The frozen document, re-read and re-hashed: a copy changed since the send is never signed. */
const checkFrozenDocument = (session: SigningSession) =>
  Effect.gen(function* () {
    const { documentKey, documentHash } = session.request
    if (documentKey === undefined || documentHash === undefined) return yield* notFound()
    const storage = yield* StorageService
    const bytes = yield* storage.downloadBounded(
      documentKey,
      UNATTRIBUTED_BUCKET,
      MAX_SIGNATURE_DOCUMENT_BYTES
    )
    if (sha256Hex(bytes) !== documentHash) {
      return yield* new SigningRefusal({
        code: 'STATEMENT_CHANGED',
        message: 'The document changed since the request was sent',
      })
    }
    return documentHash
  })

/** One signature, as the signing session posted it. */
export interface SignInput {
  readonly app: App
  readonly token: string | undefined
  /** The signer a signing page's cookie names; when set, `token` is not read. */
  readonly signerId?: string | undefined
  /** The flow, and its signer, the caller is bound to: a session of any other is not found. */
  readonly boundTo?: { readonly flow: string; readonly signer?: string | undefined } | undefined
  readonly consent: boolean
  readonly method: 'drawn' | 'typed'
  readonly typedName?: string | undefined
  readonly image?: Uint8Array | undefined
  /** The code the signature carries, when the flow verifies the signer. */
  readonly codeAnswer?: SigningCodeAnswer
  readonly network: {
    readonly ipAddress?: string | undefined
    readonly userAgent?: string | undefined
  }
  readonly forgetDerivedVariants: (key: string) => void
}

const refusal = (code: SigningRefusal['code'], message: string) =>
  Effect.fail(new SigningRefusal({ code, message }))

/** Whether the mark she gave is one the server keeps: a typed name, or a PNG within the limits. */
const hasMark = (input: SignInput): boolean =>
  input.method === 'typed'
    ? (input.typedName ?? '').trim() !== ''
    : input.image !== undefined && isAcceptableSignatureImage(input.image)

/** The checks a signature passes before its code is tried and anything is written. */
const admitted = (input: SignInput) => {
  if (!input.consent) return refusal('CONSENT_REQUIRED', 'Agree to the statement before signing')
  return hasMark(input)
    ? Effect.void
    : refusal('IMAGE_INVALID', 'Type your name, or draw a PNG within the size and dimension limits')
}

/** Store the drawn mark create-only under the request's evidence; its key and digest. */
const storedMark = (session: SigningSession, input: SignInput, evidenceId: string) =>
  Effect.gen(function* () {
    const image = input.method === 'drawn' ? input.image : undefined
    if (image === undefined) return undefined
    const name = signatureMarkName(session.signerName, evidenceId)
    const key = signatureRequestEvidenceKey(session.request.id, name)
    yield* (yield* StorageService).upload(key, image, 'image/png', {
      ...{ bucket: UNATTRIBUTED_BUCKET, uploadedById: undefined, mode: 'create-only' },
    })
    return { key, sha256: sha256Hex(image) }
  })

/** The session, checked to sign now: live, admitted, with a field to write; or how it answers. */
const signingTarget = (input: SignInput) =>
  Effect.gen(function* () {
    const { session, flow } = yield* sessionAndFlow(input.app, input.token, input.signerId)
    const { boundTo } = input
    if (
      boundTo !== undefined &&
      (boundTo.flow !== flow.name || (boundTo.signer ?? session.signerName) !== session.signerName)
    ) {
      return yield* notFound()
    }
    if (session.signerStatus === 'signed') return { kind: 'replay', session } as const
    const now = yield* nowInstant
    if (!isSigningSessionLive(stateOf(session), now.ms)) return yield* notFound()
    yield* admitted(input)
    const { field } = session
    if (field === undefined) return yield* notFound()
    const verified = yield* verifySigningCode({
      ...{ session, flow, answer: input.codeAnswer, nowMs: now.ms },
    })
    return { kind: 'sign', session, flow, field, now, verified } as const
  })

/** The name her request was sent to her under, as the send recorded it; `undefined` when none. */
const sentDisplayName = (session: SigningSession) =>
  Effect.gen(function* () {
    const signers = yield* (yield* SignatureRequestRepository).signers(session.request.id)
    return signers.find((signer) => signer.id === session.signerId)?.displayName
  })

/** Who a verified signer proved to be: email wins when the flow verifies by both channels. */
const identityOf = (flow: SignatureFlowOf, verified: boolean) => {
  if (!verified) return 'anonymous' as const
  return flow.verify?.email === true ? ('email-otp' as const) : ('sms-otp' as const)
}

/** The engine-authored value her field receives, and the `signed` event recording it. */
const signatureRecord = (
  input: SignInput,
  target: {
    readonly session: SigningSession
    readonly field: string
    readonly at: string
    readonly identity: 'anonymous' | 'email-otp' | 'sms-otp'
  },
  documentHash: string
) =>
  Effect.gen(function* () {
    const { session, field, at, identity } = target
    const evidenceId = crypto.randomUUID()
    const mark = yield* storedMark(session, input, evidenceId)
    const statement = session.request.statements[session.signerName] ?? ''
    const signerName = linkSignerName({
      ...{ method: input.method, typedName: input.typedName },
      displayName: input.method === 'drawn' ? yield* sentDisplayName(session) : undefined,
    })
    const value = {
      ...capturedSignatureValue({
        ...{ evidenceId, signedAt: at, statement, method: input.method },
        ...{ image: mark?.key ?? '', signerName, userId: undefined },
      }),
      documentHash,
      ...(identity === 'anonymous' ? {} : { identity: { kind: identity } }),
    }
    const event = {
      ...{ type: 'signed' as const, at, signer: session.signerName },
      data: {
        ...{ evidenceId, field, method: input.method, documentHash },
        ...{ statementDigest: sha256Hex(statement), identity },
        ...(mark === undefined ? {} : { markKey: mark.key, markSha256: mark.sha256 }),
      },
    }
    return { evidenceId, value, event }
  })

/** How a signature that lost answers: the uniform not-found once its request ended, else the first one. */
const lostSignature = (session: SigningSession, failure: unknown) => {
  if (failure instanceof SigningSessionClosed && failure.reason === 'ended') return notFound()
  // A second post of the same signature lost the race to the first: answer the first.
  if (failure instanceof SigningSessionClosed || failure instanceof ValidationError) {
    return replayedSignature(session)
  }
  return Effect.fail(failure)
}

/** What a signature moved, mailed and reported: the next link, the completion, the triggers. */
const afterSignature = (
  input: SignInput,
  target: { readonly session: SigningSession; readonly flow: SignatureFlowOf },
  outcome: FlowSignatureOutcome
) =>
  Effect.gen(function* () {
    const { session, flow } = target
    const { request } = session
    yield* mailSigningLinks({
      ...{ app: input.app, flow, expiresAt: request.expiresAt },
      invited: outcome.invited === undefined ? [] : [outcome.invited],
    })
    const status = requestStatusOf(outcome.status)
    const signedMove: SignatureMove = {
      ...{ flow, recordId: request.recordId },
      trigger: signatureTriggerPayload({
        ...{ requestId: request.id, event: 'signed', status },
        signer: session.signerName,
      }),
    }
    const completed =
      outcome.status === 'sealing'
        ? yield* completeSignatureRequest(roadRecordWriter, input.app, request.id)
        : []
    return { status, moves: [signedMove, ...completed] }
  })

/** Sign for the session's signer. */
export const signSignatureRequest = Effect.fn('signatures.sign-request')(function* (
  input: SignInput
) {
  const target = yield* signingTarget(input)
  if (target.kind === 'replay') return yield* replayedSignature(target.session)
  const { session, flow, field, now, verified } = target
  const documentHash = yield* checkFrozenDocument(session)
  const record = yield* signatureRecord(
    input,
    { session, field, at: now.iso, identity: identityOf(flow, verified !== undefined) },
    documentHash
  )
  const { request } = session
  const write = updateRecordWithSideEffects({
    ...{ session: buildSystemSession(), app: input.app, tableName: request.tableName },
    ...{ recordId: request.recordId, replacedAttachments: 'keep' },
    fields: { [field]: engineAuthoredSignature(record.value) },
    forgetDerivedVariants: input.forgetDerivedVariants,
  })
  const signed = yield* Effect.result(
    (yield* SignatureRequestRepository).signWith(
      {
        ...{ session, nowMs: now.ms, network: input.network, event: record.event },
        statusField: flow.output.status,
        verifiedChallenge:
          verified === undefined
            ? undefined
            : {
                challengeId: verified.challengeId,
                event: {
                  ...{ type: 'challenge-verified', at: now.iso, signer: session.signerName },
                  data: { challengeId: verified.challengeId, channel: verified.channel },
                },
              },
      },
      write
    )
  )
  if (signed._tag === 'Failure') return yield* lostSignature(session, signed.failure)
  const after = yield* afterSignature(input, { session, flow }, signed.success.outcome)
  return {
    ...{ evidenceId: record.evidenceId, signedAt: now.iso },
    ...after,
  } satisfies SignedAnswer
})

/**
 * Decline for the session's signer, with an optional reason: the request ends
 * declined. The reason is personal data: the chain records only its salted
 * commitment, and the run it triggers reads it from this call, never from the chain.
 */
export const declineSignatureRequest = Effect.fn('signatures.decline-request')(function* (input: {
  readonly app: App
  readonly token: string | undefined
  /** The signer a signing page's cookie names; when set, `token` is not read. */
  readonly signerId?: string | undefined
  readonly reason?: string | undefined
}) {
  const { session, flow } = yield* liveSigningSession(input.app, input.token, input.signerId)
  const now = yield* nowInstant
  const reason = input.reason?.trim() === '' ? undefined : input.reason?.trim()
  const requests = yield* SignatureRequestRepository
  yield* requests
    .decline({
      ...{ session, nowMs: now.ms, keepUntilMs: keepUntilFor(flow, now.ms), reason },
      event: { type: 'declined', at: now.iso, signer: session.signerName, data: {} },
    })
    .pipe(Effect.catchTag('SigningSessionClosed', () => notFound()))
  yield* writeFlowStatus(
    roadRecordWriter,
    { app: input.app, flow, recordId: session.request.recordId },
    'declined'
  )
  const move: SignatureMove = {
    ...{ flow, recordId: session.request.recordId },
    trigger: signatureTriggerPayload({
      ...{ requestId: session.request.id, event: 'declined', status: 'declined' },
      ...{ signer: session.signerName, reason },
    }),
  }
  return { status: 'declined' as const, moves: [move] }
})
