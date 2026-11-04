/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Write the signed document of a request every signer signed.
 *
 * The frozen copy is read back from the request's evidence, each placed
 * signer's mark is resolved against it (her drawn PNG, read from her evidence
 * key, or her typed name), and the copy is completed with ONE incremental
 * revision (`SignaturePdf.completeRevision`), sealed in the same revision
 * when the deployment holds a seal key (`seal-signed-document.ts`). The result is stored
 * create-only as `signed.pdf` under the request's evidence, bound to the
 * bucket of the flow's `output.signedFile` field so the record's file is
 * served there; the retention sweep alone removes it.
 *
 * Two completions racing write the same key: the second finds it taken and
 * keeps the first. The digest returned is always that of the object stored,
 * read back from storage, so the event recording it names what is there.
 */

import { Effect } from 'effect'
import { SignaturePdf, type MarkToDraw } from '@/application/ports/services/signature-pdf'
import {
  isCreateOnlyRefusal,
  StorageService,
  UNATTRIBUTED_BUCKET,
  type BucketBinding,
} from '@/application/ports/services/storage-service'
import { pictureDimensions } from '@/domain/kernel/identity/picture-dimensions'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { signatureRequestEvidenceKey } from '@/domain/models/app/signatures/signature-capture-service'
import {
  placeMark,
  placesAnyMark,
  TYPED_MARK_ASPECT,
  type SignatureDocumentLayout,
} from '@/domain/models/app/signatures/signature-placement-service'
import {
  markContents,
  markLines,
  type CompletedSigner,
} from '@/domain/models/app/signatures/signature-proof-service'
import { sealSavedDocument, type SealingPlan } from './seal-signed-document'
import type { App } from '@/domain/models/app'
import type { SignatureFlow } from '@/domain/models/app/signatures/signature'
import type { SealLevel } from '@/domain/models/app/signatures/signature-seal-service'
import type { SignatureSigner } from '@/domain/models/app/signatures/signature-signer'

/** The name of the signed document within a request's evidence. */
export const SIGNED_DOCUMENT_NAME = 'signed.pdf'

/** The largest frozen document or mark read back: the send's own limit, with room. */
const MAX_EVIDENCE_READ_BYTES = 64 * 1024 * 1024

/** A document written to the evidence: its key and the SHA-256 of what is stored there. */
export interface StoredEvidenceDocument {
  readonly key: string
  readonly sha256: string
}

/** The mark of `signer`, placed as her flow entry says; none when she has no placement. */
const markOf = (
  signer: CompletedSigner,
  entry: SignatureSigner | undefined,
  layout: SignatureDocumentLayout,
  image: Uint8Array | undefined
): MarkToDraw | undefined => {
  if (entry?.placement === undefined) return undefined
  const size = image === undefined ? undefined : pictureDimensions(image)
  const aspect = size === undefined ? TYPED_MARK_ASPECT : size.height / size.width
  const verdict = placeMark(entry.placement, layout, aspect)
  // The send refused every placement the frozen copy could not hold.
  if (!verdict.placed) return undefined
  return {
    box: verdict.box,
    contents: markContents(signer.displayName, signer.signedAt),
    lines: markLines(signer.displayName, signer.signedAt),
    image,
  }
}

/** Every placed signer's mark, her drawn image read from her evidence. */
const marksOf = (flow: SignatureFlow, frozen: Uint8Array, signers: readonly CompletedSigner[]) =>
  Effect.gen(function* () {
    if (!placesAnyMark(flow.signers)) return []
    const layout = yield* (yield* SignaturePdf).layout(frozen)
    const storage = yield* StorageService
    const marks = yield* Effect.forEach(signers, (signer) =>
      Effect.gen(function* () {
        const entry = flow.signers.find((candidate) => candidate.name === signer.name)
        const image =
          entry?.placement === undefined || signer.markKey === undefined
            ? undefined
            : yield* storage.downloadBounded(
                signer.markKey,
                UNATTRIBUTED_BUCKET,
                MAX_EVIDENCE_READ_BYTES
              )
        return markOf(signer, entry, layout, image)
      })
    )
    return marks.filter((mark): mark is MarkToDraw => mark !== undefined)
  })

/** Store `bytes` create-only at `key`; a key already written by a racing completion is kept. */
export const storeEvidenceDocument = (input: {
  readonly key: string
  readonly bytes: Uint8Array
  readonly mimeType: string
  readonly bucket: BucketBinding
}) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage
      .upload(input.key, input.bytes, input.mimeType, {
        ...{ bucket: input.bucket, uploadedById: undefined, mode: 'create-only' },
      })
      .pipe(
        Effect.catchIf(isCreateOnlyRefusal, (refusal) =>
          Effect.logInfo('A signing evidence file was already written; keeping it', refusal)
        )
      )
    const stored = yield* storage.hashObject(input.key)
    return { key: input.key, sha256: stored.sha256 } satisfies StoredEvidenceDocument
  }).pipe(Effect.withSpan('signatures.store-evidence-document', { attributes: { key: input.key } }))

/** The bucket a flow output field's file is bound to. */
export const outputBucketOf = (app: App, flow: SignatureFlow, field: string): string =>
  resolveFieldBucket(app, flow.table, field) ?? SYSTEM_BUCKET_NAME

/**
 * The frozen copy followed by its one revision: the marks, and the seal when
 * the plan has a seal key (its placeholder filled in the saved bytes, after
 * the frozen copy, which stays a byte prefix). The level the seal reached.
 */
const completedRevision = (input: {
  readonly frozen: Uint8Array
  readonly marks: readonly MarkToDraw[]
  readonly plan: SealingPlan
  readonly signedAt: Date
}) =>
  Effect.gen(function* () {
    const pdf = yield* SignaturePdf
    const sealed = input.plan.certificateSha256 !== undefined
    const saved = yield* pdf.completeRevision({
      ...{ frozen: input.frozen, marks: input.marks },
      seal: sealed ? { signedAt: input.signedAt } : undefined,
    })
    if (!sealed) return { bytes: saved, level: 'none' as SealLevel }
    return yield* sealSavedDocument({ saved, from: input.frozen.length, plan: input.plan })
  })

/** Write the signed document of request `requestId` from its frozen copy at `documentKey`. */
export const writeSignedDocument = (input: {
  readonly app: App
  readonly flow: SignatureFlow
  readonly requestId: string
  readonly documentKey: string
  readonly signers: readonly CompletedSigner[]
  readonly plan: SealingPlan
  readonly signedAt: Date
}) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const frozen = yield* storage.downloadBounded(
      input.documentKey,
      UNATTRIBUTED_BUCKET,
      MAX_EVIDENCE_READ_BYTES
    )
    const marks = yield* marksOf(input.flow, frozen, input.signers)
    const revision = yield* completedRevision({
      ...{ frozen, marks, plan: input.plan, signedAt: input.signedAt },
    })
    const stored = yield* storeEvidenceDocument({
      key: signatureRequestEvidenceKey(input.requestId, SIGNED_DOCUMENT_NAME),
      bytes: revision.bytes,
      mimeType: 'application/pdf',
      bucket: outputBucketOf(input.app, input.flow, input.flow.output.signedFile),
    })
    return { ...stored, level: revision.level }
  }).pipe(
    Effect.withSpan('signatures.write-signed-document', {
      attributes: { flow: input.flow.name, signers: input.signers.length },
    })
  )
