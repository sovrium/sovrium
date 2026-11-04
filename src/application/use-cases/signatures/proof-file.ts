/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The documents a request's completion produces: the signed document and the
 * proof file, both written BEFORE the `completed` event, which records the
 * SHA-256 of each so the chain anchors every file the export carries.
 *
 * The proof is printed from the evidence file as the chain stands once every
 * signer has signed: the request, the fingerprint of the frozen copy and of
 * the signed document, each signer with her statement, instant, method and
 * identification, every event of the log in order, and the head of the log at
 * that moment. The `completed` event follows it and links to that head. A
 * proof cannot print the hash of the event that records the proof's own
 * digest: that hash depends on the proof's bytes.
 *
 * The evidence file is attached to the proof PDF and kept beside it as
 * `evidence.json`. Both are stored create-only under the request's evidence:
 * `proof.pdf` bound to the bucket of the flow's `output.proofFile` field,
 * where the record's file is served, and `evidence.json` bound to no bucket.
 */

import { Effect } from 'effect'
import { SignatureEvidenceRepository } from '@/application/ports/repositories/signatures/signature-evidence-repository'
import { SignatureRequestRepository } from '@/application/ports/repositories/signatures/signature-request-repository'
import { SignaturePdf } from '@/application/ports/services/signature-pdf'
import { UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { signatureRequestEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import {
  completedSignersOf,
  proofLines,
  type CompletedSigner,
} from '@/domain/models/app/signatures/signature-proof-service'
import { readSignatureEvidence } from './build-signature-export'
import {
  outputBucketOf,
  storeEvidenceDocument,
  writeSignedDocument,
  type StoredEvidenceDocument,
} from './marks-signed-document'
import {
  sealSavedDocument,
  type ChainHeadTimestamp,
  type SealingPlan,
} from './seal-signed-document'
import type { EvidenceFile } from '@/domain/models/api/signatures/evidence'
import type { App } from '@/domain/models/app'
import type { SignatureFlow } from '@/domain/models/app/signatures/signature'
import type { SealLevel } from '@/domain/models/app/signatures/signature-seal-service'

/** The name of the proof file within a request's evidence. */
const PROOF_FILE_NAME = 'proof.pdf'

/** The name of the evidence file kept beside the proof. */
const EVIDENCE_FILE_NAME = 'evidence.json'

/** The signed document and the proof file of a completion, and the level their seal reached. */
export interface CompletionDocuments {
  readonly signed: StoredEvidenceDocument
  readonly proof: StoredEvidenceDocument
  readonly sealLevel: SealLevel
}

/** What the `completed` event records of the documents: where each is kept, and its SHA-256. */
export const completionEventData = (documents: CompletionDocuments | undefined) =>
  documents === undefined
    ? {}
    : {
        signedDocumentKey: documents.signed.key,
        signedDocumentSha256: documents.signed.sha256,
        proofKey: documents.proof.key,
        proofSha256: documents.proof.sha256,
      }

/** What the completion seals with and stamps, decided once for both documents and the chain. */
export interface CompletionSeal {
  readonly plan: SealingPlan
  /** The timestamp of the chain head the proof prints, when an authority is configured. */
  readonly head?: ChainHeadTimestamp | undefined
  readonly signedAt: Date
}

/** The PAdES level the evidence file spells, for a sealed level. */
const evidenceLevel = (level: SealLevel): 'B-B' | 'B-T' => (level === 'b-t' ? 'B-T' : 'B-B')

/** The evidence file as the proof prints it: the seal and the head timestamp added when present. */
const sealedEvidence = (
  evidence: EvidenceFile,
  seal: CompletionSeal,
  level: SealLevel
): EvidenceFile => ({
  ...evidence,
  ...(level === 'none' || seal.plan.certificateSha256 === undefined
    ? {}
    : {
        seal: {
          level: evidenceLevel(level),
          certificateSha256: seal.plan.certificateSha256,
        },
      }),
  head:
    seal.head === undefined
      ? evidence.head
      : {
          ...evidence.head,
          timestamp: { authority: seal.head.authority, token: seal.head.token },
        },
})

/** The proof's lines for `evidence`, its signers and its signed document. */
const linesOf = (input: {
  readonly app: App
  readonly evidence: EvidenceFile
  readonly signers: readonly CompletedSigner[]
  readonly signed: StoredEvidenceDocument
  readonly sealed: boolean
}) =>
  proofLines({
    appName: input.app.name,
    requestId: input.evidence.request.id,
    flow: input.evidence.request.flow,
    documentHash: input.evidence.document.hash,
    pages: input.evidence.document.pages,
    signedDocumentSha256: input.signed.sha256,
    sealed: input.sealed,
    signers: input.signers,
    events: input.evidence.events,
    headHash: input.evidence.head.hash,
    keepUntil: input.evidence.request.keepUntil,
    basis: input.evidence.request.basis,
  })

/** Write the proof file of request `requestId`, whose signed document is `signed`. */
const writeProofFile = (input: {
  readonly app: App
  readonly flow: SignatureFlow
  readonly requestId: string
  readonly signers: readonly CompletedSigner[]
  readonly signed: StoredEvidenceDocument
  readonly sealLevel: SealLevel
  readonly seal: CompletionSeal
  /** ISO 8601: when the evidence goes, as the completion sets it. */
  readonly keepUntil: string
}) =>
  Effect.gen(function* () {
    const read = yield* readSignatureEvidence(input.app, input.requestId)
    const evidence = sealedEvidence(
      { ...read, request: { ...read.request, keepUntil: input.keepUntil } },
      input.seal,
      input.sealLevel
    )
    const sealed = input.sealLevel !== 'none'
    const evidenceJson = new TextEncoder().encode(`${JSON.stringify(evidence, undefined, 2)}\n`)
    const saved = yield* (yield* SignaturePdf).proofFile({
      title: `Signature proof ${input.requestId}`,
      lines: linesOf({ ...input, sealed, evidence }),
      evidenceJson,
      seal: sealed ? { signedAt: input.seal.signedAt } : undefined,
    })
    const proof = sealed
      ? (yield* sealSavedDocument({ saved, from: 0, plan: input.seal.plan })).bytes
      : saved
    yield* storeEvidenceDocument({
      key: signatureRequestEvidenceKey(input.requestId, EVIDENCE_FILE_NAME),
      bytes: evidenceJson,
      mimeType: 'application/json',
      bucket: UNATTRIBUTED_BUCKET,
    })
    return yield* storeEvidenceDocument({
      key: signatureRequestEvidenceKey(input.requestId, PROOF_FILE_NAME),
      bytes: proof,
      mimeType: 'application/pdf',
      bucket: outputBucketOf(input.app, input.flow, input.flow.output.proofFile),
    })
  })

/** Every signer of `requestId` who signed, as the chain and the signer rows record her. */
const signersOfRequest = (requestId: string, statements: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    const chain = yield* (yield* SignatureEvidenceRepository).readChain(requestId)
    const rows = yield* (yield* SignatureRequestRepository).signers(requestId)
    const byName = new Map(rows.map((row) => [row.name, row]))
    return completedSignersOf({
      events: chain,
      displayNames: Object.fromEntries(rows.map((row) => [row.name, row.displayName])),
      statements,
    }).map((signer) => ({
      ...signer,
      signedAt: byName.get(signer.name)?.signedAt ?? signer.signedAt,
    }))
  })

/**
 * Write the signed document and the proof file of a request every signer
 * signed, ahead of its `completed` event; `undefined` for a request that
 * froze no document.
 */
export const buildCompletionDocuments = Effect.fn('signatures.build-completion-documents')(
  function* (input: {
    readonly app: App
    readonly flow: SignatureFlow
    readonly request: {
      readonly id: string
      readonly documentKey?: string | undefined
      readonly statements: Readonly<Record<string, string>>
    }
    readonly keepUntilMs: number
    readonly seal: CompletionSeal
  }) {
    const { app, flow, request, seal } = input
    if (request.documentKey === undefined) return undefined
    const signers = yield* signersOfRequest(request.id, request.statements)
    const written = yield* writeSignedDocument({
      ...{ app, flow, requestId: request.id, documentKey: request.documentKey, signers },
      ...{ plan: seal.plan, signedAt: seal.signedAt },
    })
    const signed = { key: written.key, sha256: written.sha256 }
    const proof = yield* writeProofFile({
      ...{ app, flow, requestId: request.id, signers, signed, seal },
      sealLevel: written.level,
      keepUntil: new Date(input.keepUntilMs).toISOString(),
    })
    return { signed, proof, sealLevel: written.level } satisfies CompletionDocuments
  }
)

/**
 * Record a completed request's documents on the request, so its export
 * carries them; resolves to the keys the record's output fields take.
 */
export const recordCompletionDocuments = Effect.fn('signatures.record-completion-documents')(
  function* (input: {
    readonly flow: SignatureFlow
    readonly requestId: string
    readonly documents: Pick<CompletionDocuments, 'signed' | 'proof'>
  }) {
    const { flow, documents } = input
    yield* (yield* SignatureEvidenceRepository).recordOutputs({
      requestId: input.requestId,
      signedDocumentKey: documents.signed.key,
      proofKey: documents.proof.key,
    })
    return {
      [flow.output.signedFile]: documents.signed.key,
      [flow.output.proofFile]: documents.proof.key,
    } as Readonly<Record<string, string>>
  }
)

/** The documents the `completed` event of a chain recorded, when it recorded both. */
const recordedDocumentsOf = (
  data: { readonly [key: string]: unknown } | undefined
): Pick<CompletionDocuments, 'signed' | 'proof'> | undefined => {
  const text = (key: string) =>
    typeof data?.[key] === 'string' ? (data[key] as string) : undefined
  const signedKey = text('signedDocumentKey')
  const signedSha = text('signedDocumentSha256')
  const proofKey = text('proofKey')
  const proofSha = text('proofSha256')
  return signedKey === undefined ||
    signedSha === undefined ||
    proofKey === undefined ||
    proofSha === undefined
    ? undefined
    : { signed: { key: signedKey, sha256: signedSha }, proof: { key: proofKey, sha256: proofSha } }
}

/**
 * The documents of a request completed by a server that stopped before
 * recording them, read back from its `completed` event and recorded now;
 * resolves to the keys the record's output fields take, or `undefined` when
 * the event names no documents.
 */
export const recoverCompletionDocuments = Effect.fn('signatures.recover-completion-documents')(
  function* (input: { readonly flow: SignatureFlow; readonly requestId: string }) {
    const chain = yield* (yield* SignatureEvidenceRepository).readChain(input.requestId)
    const documents = recordedDocumentsOf(chain.find((event) => event.type === 'completed')?.data)
    if (documents === undefined) return undefined
    return yield* recordCompletionDocuments({ ...input, documents })
  }
)
