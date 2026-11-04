/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The ends of a signing request that no signer makes: a cancel, an expiry,
 * and the completion once every signer has signed.
 *
 * Each is one conditional move (`SignatureRequestRepository.end`): the request
 * ends only from the statuses named, so a cancel and a last signature racing,
 * or the sweep and a signer, settle on one winner and the loser changes
 * nothing and reports nothing. Every end sets the date the evidence may go,
 * from the flow's `evidence.keep`, once.
 *
 * Completion: once every signer has signed the request moves to `sealing`.
 * The signed document and the proof are written and, when the deployment
 * holds a seal key, sealed (`seal-signed-document.ts`); when it names a
 * timestamp authority, the chain head and each seal are timestamped. Then the
 * request ends `completed`, with a `sealed` event before the `completed` one
 * when it was sealed. A seal or an authority that fails leaves the request in
 * `sealing`, and the sweep completes it later, as it completes a request a
 * server stopped between the two. Once complete, each signer is mailed a link
 * to her copy of the documents (`deliver-signed-documents.ts`).
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import {
  OPEN_STORED_REQUEST_STATUSES,
  requestEndedAtMs,
  signatureFlowNamed,
  signatureTriggerPayload,
} from '@/domain/models/app/signatures/signature-request-service'
import { deliverSignedDocuments } from './deliver-signed-documents'
import {
  buildCompletionDocuments,
  completionEventData,
  type CompletionDocuments,
  type CompletionSeal,
  recordCompletionDocuments,
  recoverCompletionDocuments,
} from './proof-file'
import { sealingPlanOf, stampChainHead } from './seal-signed-document'
import {
  keepUntilFor,
  nowInstant,
  writeFlowStatus,
  type FlowRecordWriter,
  type SignatureFlowOf,
} from './signature-request-effects'
import type { SignatureMove } from './sign-signature-request'
import type { App } from '@/domain/models/app'

/**
 * What a completion decides before anything is written: what it seals with,
 * the instant it seals at, and the head of the chain timestamped when an
 * authority is configured. The head is the last `signed` event: nothing else
 * is appended to a request in `sealing`.
 */
const completionSeal = (requestId: string, atMs: number) =>
  Effect.gen(function* () {
    const plan = yield* sealingPlanOf
    const chain = yield* (yield* SignatureEvidenceRepository).readChain(requestId)
    const headHash = chain.at(-1)?.hash
    const head = headHash === undefined ? undefined : yield* stampChainHead(plan, headHash)
    return { plan, head, signedAt: new Date(atMs) } satisfies CompletionSeal
  })

/** The `sealed` event of a completion whose documents were sealed, or none. */
const sealedEvents = (
  seal: CompletionSeal,
  documents: CompletionDocuments | undefined,
  at: string
) =>
  documents === undefined ||
  documents.sealLevel === 'none' ||
  seal.plan.certificateSha256 === undefined
    ? []
    : [
        {
          ...{ type: 'sealed' as const, at },
          data: {
            level: documents.sealLevel,
            certificateSha256: seal.plan.certificateSha256,
            signedDocumentSha256: documents.signed.sha256,
            proofSha256: documents.proof.sha256,
          },
        },
      ]

/**
 * The seal, the timestamps and the documents of a completion, written before
 * its events, which anchor their digests; `undefined` when the seal or the
 * timestamp authority failed, leaving the request `sealing` for the sweep.
 */
const prepareCompletion = (input: {
  readonly app: App
  readonly flow: SignatureFlowOf
  readonly request: Parameters<typeof buildCompletionDocuments>[0]['request']
  readonly keepUntilMs: number
  readonly nowMs: number
}) =>
  Effect.gen(function* () {
    const seal = yield* completionSeal(input.request.id, input.nowMs)
    const documents = yield* buildCompletionDocuments({
      ...{ app: input.app, flow: input.flow, request: input.request },
      ...{ keepUntilMs: input.keepUntilMs, seal },
    })
    return { seal, documents }
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logWarning('A signed request could not be sealed yet; it stays sealing', cause)
    ),
    // effect-swallow: the request stays `sealing`; the sweep retries the seal and the timestamp every minute.
    Effect.catchTags({
      SealFailure: () => Effect.void,
      TimestampFailure: () => Effect.void,
    })
  )

/** What the `completed` event records: the seal level, the documents and the head timestamp. */
const completedEventData = (prepared: {
  readonly seal: CompletionSeal
  readonly documents: CompletionDocuments | undefined
}) => {
  const sealLevel = prepared.documents?.sealLevel ?? 'none'
  return {
    ...{ sealed: sealLevel !== 'none', sealLevel },
    ...completionEventData(prepared.documents),
    ...(prepared.seal.head === undefined ? {} : { timestamp: { ...prepared.seal.head } }),
  }
}

/**
 * After a completion: its documents recorded on the request and written into
 * the record with the status, and each signer mailed her copy.
 */
const settleCompletedRecord = <R>(
  writer: FlowRecordWriter<R>,
  target: {
    readonly app: App
    readonly flow: SignatureFlowOf
    readonly recordId: string
    readonly requestId: string
  },
  documents: CompletionDocuments | undefined
) =>
  Effect.gen(function* () {
    const { app, flow, recordId, requestId } = target
    const files =
      documents === undefined
        ? {}
        : yield* recordCompletionDocuments({ flow, requestId, documents })
    yield* writeFlowStatus(writer, { app, flow, recordId }, 'completed', files)
    if (documents !== undefined) yield* deliverSignedDocuments({ app, requestId })
  })

/** The moves a completion reports: `sealed` when it sealed, then `completed`. */
const completionMoves = (input: {
  readonly flow: SignatureFlowOf
  readonly recordId: string
  readonly requestId: string
  readonly sealed: boolean
}): readonly SignatureMove[] =>
  (input.sealed ? (['sealed', 'completed'] as const) : (['completed'] as const)).map((event) => ({
    ...{ flow: input.flow, recordId: input.recordId },
    trigger: signatureTriggerPayload({
      ...{ requestId: input.requestId, event, status: 'completed' },
    }),
  }))

/**
 * Complete a request every signer signed; its moves (none when another move
 * completed it first, or when the seal or the timestamp authority failed: the
 * request then stays `sealing` and the sweep tries again).
 */
export const completeSignatureRequest = Effect.fn('signatures.complete-request')(function* <R>(
  writer: FlowRecordWriter<R>,
  app: App,
  requestId: string
) {
  const requests = yield* SignatureRequestRepository
  const request = yield* requests.read(requestId)
  const flow = request === undefined ? undefined : signatureFlowNamed(app, request.flowName)
  if (request === undefined || flow === undefined) return []
  if (request.status !== 'sealing') return []
  const now = yield* nowInstant
  const keepUntilMs = keepUntilFor(flow, now.ms)
  const prepared = yield* prepareCompletion({ app, flow, request, keepUntilMs, nowMs: now.ms })
  if (prepared === undefined) return []
  const { seal, documents } = prepared
  const before = sealedEvents(seal, documents, now.iso)
  const ended = yield* requests.end({
    ...{ requestId, from: ['sealing'], status: 'completed' },
    ...{ nowMs: now.ms, keepUntilMs, before, sealLevel: documents?.sealLevel },
    event: { type: 'completed', at: now.iso, data: completedEventData(prepared) },
  })
  if (ended === undefined) return []
  yield* settleCompletedRecord(
    writer,
    { app, flow, recordId: request.recordId, requestId },
    documents
  )
  return completionMoves({
    ...{ flow, recordId: request.recordId, requestId },
    sealed: before.length > 0,
  })
})

/**
 * Finish a request a server completed but stopped before recording its
 * documents: record them, write them and the status into the record, and
 * return the `completed` move its automations never received.
 */
const recoverCompletedRequest = Effect.fn('signatures.recover-completed-request')(function* <R>(
  writer: FlowRecordWriter<R>,
  app: App,
  requestId: string
) {
  const request = yield* (yield* SignatureRequestRepository).read(requestId)
  const flow = request === undefined ? undefined : signatureFlowNamed(app, request.flowName)
  if (request === undefined || flow === undefined) return []
  const files = yield* recoverCompletionDocuments({ flow, requestId })
  if (files === undefined) return []
  yield* writeFlowStatus(writer, { app, flow, recordId: request.recordId }, 'completed', files)
  return [
    {
      ...{ flow, recordId: request.recordId },
      trigger: signatureTriggerPayload({ requestId, event: 'completed', status: 'completed' }),
    },
  ] satisfies readonly SignatureMove[]
})

/** End one open request as `status`, with its reason when given; its move, or none. */
const endOpenRequest = <R>(input: {
  readonly writer: FlowRecordWriter<R>
  readonly app: App
  readonly requestId: string
  readonly status: 'cancelled' | 'expired'
  readonly reason?: string | undefined
}) =>
  Effect.gen(function* () {
    const requests = yield* SignatureRequestRepository
    const request = yield* requests.read(input.requestId)
    const flow = request === undefined ? undefined : signatureFlowNamed(input.app, request.flowName)
    if (request === undefined || flow === undefined) return undefined
    const now = yield* nowInstant
    const reason = input.reason?.trim() === '' ? undefined : input.reason?.trim()
    const endedAtMs = requestEndedAtMs({
      ...{ status: input.status, nowMs: now.ms },
      expiresAtMs: request.expiresAt === undefined ? undefined : Date.parse(request.expiresAt),
    })
    const ended = yield* requests.end({
      ...{ requestId: input.requestId, from: OPEN_STORED_REQUEST_STATUSES, status: input.status },
      ...{ nowMs: now.ms, keepUntilMs: keepUntilFor(flow, endedAtMs) },
      event: { type: input.status, at: now.iso, data: reason === undefined ? {} : { reason } },
    })
    if (ended === undefined) return undefined
    yield* writeFlowStatus(
      input.writer,
      { app: input.app, flow, recordId: request.recordId },
      input.status
    )
    return {
      ...{ flow, recordId: request.recordId },
      trigger: signatureTriggerPayload({
        ...{ requestId: input.requestId, event: input.status, status: input.status },
        reason,
      }),
    } satisfies SignatureMove
  })

/** What a cancel step reports: whether it ended a request, and which. */
export type CancelOutcome =
  | { readonly cancelled: false }
  | {
      readonly cancelled: true
      readonly requestId: string
      readonly status: 'cancelled'
      readonly move: SignatureMove
    }

/** Cancel the open request of `flowName` on one record; nothing when it has none. */
export const cancelSignatureRequest = <R>(input: {
  readonly writer: FlowRecordWriter<R>
  readonly app: App
  readonly flowName: string
  readonly recordId: string
  readonly reason?: string | undefined
}) =>
  Effect.gen(function* () {
    const flow = signatureFlowNamed(input.app, input.flowName)
    if (flow === undefined) return { cancelled: false } satisfies CancelOutcome
    const requests = yield* SignatureRequestRepository
    const open = yield* requests.unended({
      ...{ flowName: flow.name, tableName: flow.table, recordId: input.recordId },
    })
    if (open === undefined) return { cancelled: false } satisfies CancelOutcome
    const move = yield* endOpenRequest({
      ...{ writer: input.writer, app: input.app, requestId: open.id },
      ...{ status: 'cancelled', reason: input.reason },
    })
    if (move === undefined) return { cancelled: false } satisfies CancelOutcome
    return {
      ...{ cancelled: true, requestId: open.id, status: 'cancelled', move },
    } satisfies CancelOutcome
  }).pipe(Effect.withSpan('signatures.cancel-request', { attributes: { flow: input.flowName } }))

/**
 * One pass of the request sweep: every open request past its deadline ends
 * `expired`, and every request whose last signature was given but which was
 * never completed is completed. Resolves to the moves it made.
 */
export const sweepSignatureRequests = Effect.fn('signatures.sweep-requests')(function* <R>(
  writer: FlowRecordWriter<R>,
  app: App
) {
  const requests = yield* SignatureRequestRepository
  const now = yield* nowInstant
  const overdue = yield* requests.overdue(now.ms)
  const expired = yield* Effect.forEach(overdue, (requestId) =>
    endOpenRequest({ writer, app, requestId, status: 'expired' })
  )
  const completed = yield* Effect.forEach(yield* requests.sealing, (requestId) =>
    completeSignatureRequest(writer, app, requestId)
  )
  const recovered = yield* Effect.forEach(
    yield* (yield* SignatureEvidenceRepository).completedWithoutOutputs,
    (requestId) => recoverCompletedRequest(writer, app, requestId)
  )
  return [
    ...expired.filter((move): move is SignatureMove => move !== undefined),
    ...completed.flat(),
    ...recovered.flat(),
  ] as readonly SignatureMove[]
})
