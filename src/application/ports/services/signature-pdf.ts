/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The PDF work of a signing request after its document is frozen.
 *
 * - `layout` reads the pages and named boxes of the frozen copy, which a
 *   placement is resolved against when the request is sent.
 * - `completeRevision` writes the signed document: the frozen copy byte for
 *   byte, followed by ONE incremental revision. That revision carries one
 *   stamp per placed signer (never a signature field) and, when the server
 *   seals, the seal: everything completion adds goes into this one revision,
 *   so the fingerprint every signer signed is a prefix of the signed file.
 *   With `seal`, the revision declares the seal on the frozen copy's seal
 *   field and leaves its placeholder to fill.
 * - `proofFile` prints the proof: a separate PDF listing the request, with
 *   the evidence file attached.
 */

import { Context, Data, type Effect } from 'effect'
import type {
  MarkBox,
  SignatureDocumentLayout,
} from '@/domain/models/app/signatures/signature-placement-service'
import type { ProofLine } from '@/domain/models/app/signatures/signature-proof-service'

/** A signing PDF could not be read or written. */
export class SignaturePdfFailure extends Data.TaggedError('SignaturePdfFailure')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** One signer's mark to draw. */
export interface MarkToDraw {
  readonly box: MarkBox
  /** The stamp's text: who signed and when. */
  readonly contents: string
  /** The two lines a typed mark draws; drawn under the image of a drawn one. */
  readonly lines: readonly [string, string]
  /** The drawn signature, a PNG, when she drew one. */
  readonly image?: Uint8Array | undefined
}

/**
 * A seal to leave room for: the document is saved with a placeholder
 * signature (`signature-seal-service.ts`) the caller fills once it has signed
 * the saved bytes.
 */
export interface SealPlaceholderRequest {
  /** The instant the seal is dated (`/M`). */
  readonly signedAt: Date
}

export class SignaturePdf extends Context.Service<
  SignaturePdf,
  {
    readonly layout: (
      frozen: Uint8Array
    ) => Effect.Effect<SignatureDocumentLayout, SignaturePdfFailure>
    readonly completeRevision: (input: {
      readonly frozen: Uint8Array
      readonly marks: readonly MarkToDraw[]
      /** Leave the seal's placeholder in the revision, dated `signedAt`. */
      readonly seal?: SealPlaceholderRequest | undefined
    }) => Effect.Effect<Uint8Array, SignaturePdfFailure>
    readonly proofFile: (input: {
      readonly title: string
      readonly lines: readonly ProofLine[]
      readonly evidenceJson: Uint8Array
      /** Leave a seal placeholder in the proof, dated `signedAt`. */
      readonly seal?: SealPlaceholderRequest | undefined
    }) => Effect.Effect<Uint8Array, SignaturePdfFailure>
  }
>()('SignaturePdf') {}
