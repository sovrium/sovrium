/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The organisation seal and the outside timestamp of a completed request.
 *
 * {@link sealingPlanOf} reads what this deployment seals with: the seal
 * certificate's fingerprint when a seal key is configured, and the timestamp
 * authority when one is. Either may be absent: no key leaves the documents
 * unsealed (and the proof says so), no authority leaves the chain and the seal
 * untimestamped.
 *
 * {@link sealSavedDocument} fills the placeholder a document was saved with:
 * the real `/ByteRange` written in, the SHA-256 of the two spans signed by the
 * seal, the signature value timestamped when an authority is configured
 * (level B-T, else B-B), and the CMS written into `/Contents`. Nothing outside
 * the `/Contents` string changes once the digest is taken.
 *
 * {@link stampChainHead} timestamps the head of a request's chain: the token
 * stamps the head hash itself, so it proves every event up to that head
 * existed by the token's time.
 *
 * A seal that cannot sign, or an authority that gives no usable token, fails
 * the step: the caller leaves the request `sealing` and the sweep retries. A
 * configured authority is never skipped.
 */

import { Buffer } from 'node:buffer'
import { Effect } from 'effect'
import { PdfSealer, SealFailure } from '@/application/ports/services/pdf-sealer'
import { TimestampAuthority } from '@/application/ports/services/timestamp-authority'
import {
  chainHeadImprint,
  fixSealSlot,
  sha256Bytes,
  signedSpans,
  withSealContents,
  type SealLevel,
} from '@/domain/models/app/signatures/signature-seal-service'

/** What a completion seals with. */
export interface SealingPlan {
  /** SHA-256 of the seal certificate, when a seal key is configured. */
  readonly certificateSha256?: string | undefined
  /** The timestamp authority URL, when one is configured. */
  readonly authority?: string | undefined
}

/** A document sealed: its bytes and the level its seal reached. */
export interface SealedDocument {
  readonly bytes: Uint8Array
  readonly level: Exclude<SealLevel, 'none'>
}

/** A chain head timestamped: the authority, the token (base64) and the hash it stamps. */
export interface ChainHeadTimestamp {
  readonly authority: string
  readonly token: string
  readonly anchoredHash: string
}

/** This deployment's seal and timestamp authority. */
export const sealingPlanOf = Effect.gen(function* () {
  const certificateSha256 = yield* (yield* PdfSealer).configured
  const authority = yield* (yield* TimestampAuthority).authority
  return { certificateSha256, authority } satisfies SealingPlan
}).pipe(Effect.withSpan('signatures.sealing-plan'))

/** Seal `saved`, a document saved with a seal placeholder at or after byte `from`. */
export const sealSavedDocument = Effect.fn('signatures.seal-document')(function* (input: {
  readonly saved: Uint8Array
  readonly from: number
  readonly plan: SealingPlan
}) {
  const fixed = fixSealSlot(input.saved, input.from)
  if (fixed === undefined) {
    return yield* new SealFailure({ message: 'The seal placeholder was not found in the document' })
  }
  const digest = sha256Bytes(signedSpans(fixed.bytes, fixed.slot.byteRange))
  const signature = yield* (yield* PdfSealer).sign(digest)
  const token =
    input.plan.authority === undefined
      ? undefined
      : yield* (yield* TimestampAuthority).stamp(sha256Bytes(signature.signatureValue))
  const bytes = withSealContents(fixed.bytes, fixed.slot, signature.toCms(token))
  if (bytes === undefined) {
    return yield* new SealFailure({ message: 'The seal does not fit its placeholder' })
  }
  return { bytes, level: token === undefined ? 'b-b' : 'b-t' } satisfies SealedDocument
})

/** Timestamp the chain head `headHash` when an authority is configured; `undefined` otherwise. */
export const stampChainHead = Effect.fn('signatures.stamp-chain-head')(function* (
  plan: SealingPlan,
  headHash: string
) {
  if (plan.authority === undefined) return undefined
  const token = yield* (yield* TimestampAuthority).stamp(chainHeadImprint(headHash))
  return {
    ...{ authority: plan.authority, anchoredHash: headHash },
    token: Buffer.from(token).toString('base64'),
  } satisfies ChainHeadTimestamp
})
