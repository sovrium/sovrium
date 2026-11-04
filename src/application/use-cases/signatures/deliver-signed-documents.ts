/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Each signer's copy of a completed request.
 *
 * {@link deliverSignedDocuments} runs once a request completes with its
 * documents: every signer who signed gets a link of her own (a token stored
 * only as its digest, valid {@link DELIVERY_LINK_DAYS} days), mailed to the
 * address the request was sent to, and the chain records one `delivered`
 * event per signer: when the link stops working, by which channel, never the
 * address. A mail that cannot be sent is logged; the request is complete
 * either way, and its documents stay in the record.
 *
 * {@link readDeliveredDocument} answers a link: the signed document or the
 * proof, from the request's evidence (never from the record, which may have
 * changed since), for a token that names a signer who signed a completed
 * request and has not expired. Every other case is the same not-found.
 */

import { Effect, Schema } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { EmailSender } from '@/application/ports/services/email-sender'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { NotFoundError } from '@/domain/errors'
import { escapeHtmlAttribute } from '@/domain/kernel/sanitize/html-escaping'
import {
  DELIVERED_FILES,
  DELIVERY_LINK_DAYS,
  deliveredFileSchema,
  deliveryTokenSchema,
  type DeliveredFile,
} from '@/domain/models/api/signatures/deliveries'
import { displayNameOf } from '@/domain/models/app/display-name-service'
import { signatureRequestEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import { nowInstant } from './signature-request-effects'
import type { InvitedSigner } from '@/application/ports/repositories/signatures/signature-request-repository'
import type { App } from '@/domain/models/app'

/** A day, in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000

/** The largest document a link answers: the size a signed contract and its proof can reach. */
const MAX_DELIVERED_BYTES = 100 * 1024 * 1024

/** The path a link to `file` takes for `token`. */
const deliveryPath = (token: string, file: DeliveredFile): string =>
  `/api/signatures/deliveries/${token}/${file}`

/** The mail one signer receives: neutral words, her two links, and when they stop working. */
const deliveryMail = (input: {
  readonly appName: string
  readonly displayName: string
  readonly links: Readonly<Record<DeliveredFile, string>>
  readonly expiresAt: string
}) => {
  const greeting = input.displayName === '' ? 'Hello,' : `Hello ${input.displayName},`
  const until = `These links are yours alone and work until ${new Date(input.expiresAt).toUTCString()}.`
  const signed = input.links['signed.pdf']
  const proof = input.links['proof.pdf']
  return {
    subject: `${input.appName}: your signed document`,
    text: `${greeting}\n\nEvery signer has signed. Your copy of the signed document:\n${signed}\n\nIts proof file, which records how and when each person signed:\n${proof}\n\n${until}`,
    html: `<p>${escapeHtmlAttribute(greeting)}</p><p>Every signer has signed.</p><p><a href="${escapeHtmlAttribute(signed)}">Download the signed document</a></p><p><a href="${escapeHtmlAttribute(proof)}">Download the proof file</a>, which records how and when each person signed.</p><p>${escapeHtmlAttribute(until)}</p>`,
  }
}

/** Mail one signer her links and record the delivery in the chain. */
const deliverTo = (input: {
  readonly app: App
  readonly requestId: string
  readonly signer: InvitedSigner
  readonly origin: string
  readonly expiresAt: string
}) =>
  Effect.gen(function* () {
    const { signer } = input
    const links = Object.fromEntries(
      DELIVERED_FILES.map((file) => [file, `${input.origin}${deliveryPath(signer.token, file)}`])
    ) as Readonly<Record<DeliveredFile, string>>
    yield* (yield* EmailSender).send({
      to: signer.email,
      fromName: displayNameOf(input.app),
      ...deliveryMail({
        ...{ appName: displayNameOf(input.app), displayName: signer.displayName, links },
        expiresAt: input.expiresAt,
      }),
    })
    const now = yield* nowInstant
    yield* (yield* SignatureEvidenceRepository).appendEvent(input.requestId, {
      ...{ type: 'delivered', at: now.iso, signer: signer.name },
      data: { channel: 'email', files: [...DELIVERED_FILES], expiresAt: input.expiresAt },
    })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.logError(`The signed documents could not be delivered to ${input.signer.name}`, cause)
    ),
    // effect-swallow: the request is complete and its documents are in the record; a failed mail is logged for the operator.
    Effect.ignoreCause
  )

/** Give every signer of the completed request `requestId` her copy, by mail. */
export const deliverSignedDocuments = Effect.fn('signatures.deliver-documents')(function* (input: {
  readonly app: App
  readonly requestId: string
}) {
  const now = yield* nowInstant
  const expiresAtMs = now.ms + DELIVERY_LINK_DAYS * DAY_MS
  const expiresAt = new Date(expiresAtMs).toISOString()
  const signers = yield* (yield* SignatureRequestRepository).issueDeliveryLinks({
    ...{ requestId: input.requestId, expiresAtMs },
  })
  if (signers.length === 0) return
  const origin = yield* (yield* ServerOrigin).current
  yield* Effect.forEach(
    signers,
    (signer) =>
      deliverTo({ ...{ app: input.app, requestId: input.requestId }, signer, origin, expiresAt }),
    { discard: true }
  )
})

const notFound = Effect.fail(new NotFoundError('Document not found', 'delivery'))

/** The document a delivery link opens: its bytes and name, or the uniform not-found. */
export const readDeliveredDocument = Effect.fn('signatures.read-delivered-document')(
  function* (input: { readonly token: string; readonly file: string }) {
    const token = Schema.decodeOption(deliveryTokenSchema)(input.token)
    const file = Schema.decodeUnknownOption(deliveredFileSchema)(input.file)
    if (token._tag === 'None' || file._tag === 'None') return yield* notFound
    const session = yield* (yield* SignatureRequestRepository).session(token.value)
    const now = (yield* nowInstant).ms
    const expiresAt = session?.tokenExpiresAt === undefined ? 0 : Date.parse(session.tokenExpiresAt)
    if (
      session === undefined ||
      session.signerStatus !== 'signed' ||
      session.request.status !== 'completed' ||
      !(expiresAt > now)
    ) {
      return yield* notFound
    }
    const bytes = yield* (yield* StorageService)
      .downloadBounded(
        signatureRequestEvidenceKey(session.request.id, file.value),
        UNATTRIBUTED_BUCKET,
        MAX_DELIVERED_BYTES
      )
      .pipe(
        Effect.tapCause((cause) =>
          Effect.logWarning('A delivered document could not be read', cause)
        ),
        // effect-swallow: a document missing from storage answers the same not-found as an unknown link.
        Effect.catchCause(() => notFound)
      )
    return { bytes, file: file.value }
  }
)
