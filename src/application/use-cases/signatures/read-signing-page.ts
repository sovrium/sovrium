/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a signing page reads in its session: the `$signing` context its
 * components print, and the frozen document its address serves.
 *
 * A session is named by the signing page's cookie, never by the link token: the
 * link was exchanged for it, and the address no longer carries it. It shows its
 * page while its request has not ended, its signer has not declined, and the
 * page is the one its flow names; anything else is the same not-found, so a
 * session never tells which it was.
 *
 * The context is built from the request the session names: the statement and
 * the document frozen at send, the signer's name as sent. The live record is
 * read for the fields the flow lists in `surface.fields` and no other, and for
 * the signer's own signature once she has signed.
 */

import { Effect } from 'effect'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { NotFoundError } from '@/domain/errors'
import {
  MAX_SIGNATURE_DOCUMENT_BYTES,
  requestStatusOf,
  signatureFlowNamed,
  signerStatusOf,
} from '@/domain/models/app/signatures/signature-request-service'
import {
  isSigningPageOpen,
  listedRecordFields,
  pdfPageCount,
  requiredChannelsOf,
  type SigningPage,
} from '@/domain/models/app/signatures/signing-page-service'
import { nowInstant } from './signature-request-effects'
import type { SigningSession } from '@/application/ports/repositories/signatures/signature-request-repository'
import type { SigningContext } from '@/domain/models/api/signatures/common'
import type { App } from '@/domain/models/app'

/** The uniform answer for every session that shows no page. */
const notFound = () => Effect.fail(new NotFoundError('Signing session not found'))

/** The session `signerId` names while it still shows its page, with its flow; else not found. */
const openSession = (app: App, signerId: string, pageName: string | undefined) =>
  Effect.gen(function* () {
    const session = yield* (yield* SignatureRequestRepository).sessionOfSigner(signerId)
    const flow =
      session === undefined ? undefined : signatureFlowNamed(app, session.request.flowName)
    const now = yield* nowInstant
    if (
      session === undefined ||
      flow === undefined ||
      (pageName !== undefined && flow.surface.page !== pageName) ||
      !isSigningPageOpen(
        {
          ...{ requestStatus: session.request.status, signerStatus: session.signerStatus },
          requestExpiresAt: session.request.expiresAt,
        },
        now.ms
      )
    ) {
      return yield* notFound()
    }
    return { session, flow }
  })

/** The frozen document's bytes, read from its evidence key. */
const frozenBytes = (session: SigningSession) =>
  Effect.gen(function* () {
    const key = session.request.documentKey
    if (key === undefined) return yield* notFound()
    return yield* (yield* StorageService).downloadBounded(
      key,
      UNATTRIBUTED_BUCKET,
      MAX_SIGNATURE_DOCUMENT_BYTES
    )
  })

/** The `$signing` context and stored signature of the session `signerId` names, on `pageName`. */
export const readSigningPage = Effect.fn('signatures.read-signing-page')(function* (input: {
  readonly app: App
  readonly signerId: string
  readonly pageName: string
  /** The address the session's frozen document is served at. */
  readonly documentUrl: string
}) {
  const { session, flow } = yield* openSession(input.app, input.signerId, input.pageName)
  const { request } = session
  const signers = yield* (yield* SignatureRequestRepository).signers(request.id)
  const record = yield* (yield* TableRepository).getRecord(
    buildSystemSession(),
    request.tableName,
    request.recordId
  )
  if (record === null || request.documentHash === undefined) return yield* notFound()
  const pages = pdfPageCount(yield* frozenBytes(session))
  const required = requiredChannelsOf(flow.verify)
  const context: SigningContext = {
    request: {
      ...{ id: request.id, flow: request.flowName, status: requestStatusOf(request.status) },
      expiresAt: request.expiresAt ?? request.createdAt,
    },
    signer: {
      name: session.signerName,
      displayName: signers.find((signer) => signer.id === session.signerId)?.displayName ?? '',
      status: signerStatusOf(session.signerStatus),
    },
    statement: request.statements[session.signerName] ?? '',
    document: { url: input.documentUrl, hash: request.documentHash, pages },
    verification: { required, verified: session.signerStatus === 'verified' ? required : [] },
    record: listedRecordFields(record, flow.surface.fields),
  }
  const signed = session.signerStatus === 'signed' && session.field !== undefined
  return {
    context,
    ...(signed ? { signedValue: record[session.field as string] } : {}),
  } satisfies SigningPage
})

/** The frozen document of the session `signerId` names, while it shows its page; else not found. */
export const readSigningDocument = Effect.fn('signatures.read-signing-document')(function* (
  app: App,
  signerId: string
) {
  const { session } = yield* openSession(app, signerId, undefined)
  return yield* frozenBytes(session)
})
