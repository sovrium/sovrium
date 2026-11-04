/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The organisation seal of a deployment (`SIGNATURE_SEAL_KEY` and
 * `SIGNATURE_SEAL_CERT_CHAIN`): the key that signs a completed document as
 * having left this server unchanged. It says nothing of who signed; the
 * signers are in the evidence.
 *
 * `configured` is the seal certificate's SHA-256, or `undefined` when the
 * deployment has no seal. `sign(digest)` signs the SHA-256 of a PDF's byte
 * ranges and resolves to the raw signature value and a function that wraps it
 * in its CMS, with or without the RFC 3161 token the caller fetched over that
 * value (level B-T, or B-B without one).
 */

import { Context, Data, type Effect } from 'effect'

/** The seal could not sign. */
export class SealFailure extends Data.TaggedError('SealFailure')<{
  readonly message: string
  readonly cause?: unknown
}> {}

/** A seal signature over one digest. */
export interface SealSignature {
  /** The raw signature value, which a B-T timestamp is taken over. */
  readonly signatureValue: Uint8Array
  /** SHA-256 of the seal certificate, lowercase hexadecimal. */
  readonly certificateSha256: string
  /** The CMS `SignedData` (DER) for the PDF's `/Contents`, with the token when given. */
  readonly toCms: (timestampToken?: Uint8Array) => Uint8Array
}

export class PdfSealer extends Context.Service<
  PdfSealer,
  {
    readonly configured: Effect.Effect<string | undefined, SealFailure>
    readonly sign: (digest: Uint8Array) => Effect.Effect<SealSignature, SealFailure>
  }
>()('PdfSealer') {}
