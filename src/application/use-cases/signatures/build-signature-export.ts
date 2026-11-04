/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The evidence file of a signing request (`evidence.json`) and its export
 * bundle, the one document `sovrium signature verify` checks offline.
 *
 * Both are assembled from the evidence tables and the evidence namespace of
 * the storage: never from the record, which may have changed or gone since.
 * The bundle carries the frozen document, the signed document, the proof file
 * and every signer's mark, each read back from storage and hashed as it
 * stands, so a file altered in storage fails the verifier's `files` or
 * `document` check.
 *
 * The retention printed is the request's `keep_until`. A request still running
 * has none yet: it prints the date its retention would end were it to end at
 * its deadline. A signature captured on a record belongs to no flow and keeps
 * no retention of its own (its evidence follows its record and its signer), so
 * its evidence file prints neither a deletion date nor a basis. A request of a
 * flow the config no longer declares has no retention to print, and is
 * answered as not found.
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { NotFoundError } from '@/domain/errors'
import {
  isRecordCaptureFlowName,
  signatureEvidenceImageKey,
} from '@/domain/models/app/signatures/signature-capture-service'
import { evidenceKeepUntil } from '@/domain/models/app/signatures/signature-evidence-chain-service'
import {
  evidenceFileOf,
  exportManifestOf,
  type ExportFileInput,
} from '@/domain/models/app/signatures/signature-evidence-file-service'
import type {
  StoredSignatureRequest,
  StoredSignatureSigner,
} from '@/application/ports/repositories/signatures/signature-evidence-repository'
import type { App } from '@/domain/models/app'
import type { ChainedSignatureEvent } from '@/domain/models/app/signatures/signature-evidence-chain-service'

/** The largest evidence file an export reads back: a signed contract, not an archive. */
const MAX_EVIDENCE_FILE_BYTES = 100 * 1024 * 1024

/** The flow a request was made from, as the config declares it now. */
const flowOf = (app: App, request: StoredSignatureRequest) =>
  app.signatures?.find((flow) => flow.name === request.flowName)

/** When the request's evidence goes: its `keep_until`, else the projection from its deadline. */
const keepUntilOf = (app: App, request: StoredSignatureRequest): string | undefined => {
  if (request.keepUntil !== undefined) return request.keepUntil
  const flow = flowOf(app, request)
  const ends = request.completedAt ?? request.expiresAt ?? request.createdAt
  const projected =
    flow === undefined ? undefined : evidenceKeepUntil(Date.parse(ends), flow.evidence.keep)
  return projected === undefined ? undefined : new Date(projected).toISOString()
}

/** Everything the evidence file of `requestId` is assembled from. */
const evidenceOf = (app: App, requestId: string) =>
  Effect.gen(function* () {
    const repo = yield* SignatureEvidenceRepository
    const request = yield* repo.readRequest(requestId)
    const inline = request !== undefined && isRecordCaptureFlowName(request.flowName)
    const keepUntil = request === undefined || inline ? undefined : keepUntilOf(app, request)
    if (request === undefined || (keepUntil === undefined && !inline)) {
      return yield* Effect.fail(new NotFoundError('Signature request not found', requestId))
    }
    const signers = yield* repo.readSigners(requestId)
    const events = yield* repo.readChain(requestId)
    return { request, signers, events, keepUntil }
  })

/** The pages the `sent` event recorded for the frozen document; 0 for a request that froze none. */
const sentPagesOf = (events: readonly ChainedSignatureEvent[]): number => {
  const pages = events.find((event) => event.type === 'sent')?.data['pages']
  return typeof pages === 'number' ? pages : 0
}

const assembled = (input: {
  readonly app: App
  readonly request: StoredSignatureRequest
  readonly signers: readonly StoredSignatureSigner[]
  readonly events: readonly ChainedSignatureEvent[]
  readonly keepUntil: string | undefined
}) =>
  evidenceFileOf({
    request: {
      ...{ id: input.request.id, flow: input.request.flowName },
      basis:
        input.keepUntil === undefined
          ? undefined
          : flowOf(input.app, input.request)?.evidence.basis,
      keepUntil: input.keepUntil,
      documentHash: input.request.documentHash,
      // The page count the send recorded with the frozen document, in its `sent` event.
      pages: sentPagesOf(input.events),
      statements: input.request.statements,
    },
    signers: input.signers.map((signer) => ({
      name: signer.signerName,
      identityKind: signer.identityKind,
    })),
    events: input.events,
  })

/** The evidence file of request `requestId`. */
export const readSignatureEvidence = (app: App, requestId: string) =>
  evidenceOf(app, requestId).pipe(
    Effect.map((evidence) => assembled({ app, ...evidence })),
    Effect.withSpan('signatures.read-evidence')
  )

/** The stored files an export carries: the documents the request froze, and each mark. */
const exportedKeys = (
  request: StoredSignatureRequest,
  events: readonly ChainedSignatureEvent[]
): readonly Omit<ExportFileInput, 'bytes'>[] => {
  const documents: readonly Omit<ExportFileInput, 'bytes'>[] = [
    ...(request.documentKey === undefined
      ? []
      : [{ path: request.documentKey, role: 'frozen-document' as const }]),
    ...(request.sealedDocumentKey === undefined
      ? []
      : [{ path: request.sealedDocumentKey, role: 'signed-document' as const }]),
    ...(request.proofKey === undefined ? [] : [{ path: request.proofKey, role: 'proof' as const }]),
  ]
  const marks = events
    .filter((event) => event.type === 'signed' && typeof event.data['markSha256'] === 'string')
    .map((event) => {
      const { markKey, evidenceId } = event.data
      if (typeof markKey === 'string') return markKey
      return typeof evidenceId === 'string' ? signatureEvidenceImageKey(evidenceId) : undefined
    })
    .filter((key): key is string => key !== undefined)
    .map((key) => ({ path: key, role: 'mark' as const }))
  return [...documents, ...marks]
}

/** The export bundle of request `requestId`. */
export const buildSignatureExport = Effect.fn('signatures.build-export')(function* (
  app: App,
  requestId: string
) {
  const evidence = yield* evidenceOf(app, requestId)
  const storage = yield* StorageService
  const files = yield* Effect.forEach(exportedKeys(evidence.request, evidence.events), (file) =>
    storage
      .downloadBounded(file.path, UNATTRIBUTED_BUCKET, MAX_EVIDENCE_FILE_BYTES)
      .pipe(Effect.map((bytes) => ({ ...file, bytes })))
  )
  return exportManifestOf(assembled({ app, ...evidence }), files)
})
