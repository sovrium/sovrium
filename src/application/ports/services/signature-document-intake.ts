/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The document a signing request freezes, checked and rewritten once.
 *
 * `prepare` takes the PDF a record holds and either refuses it, naming why
 * ({@link SignatureDocumentRefusal}), or answers the one copy every signer
 * signs: rewritten without object streams, every unsigned signature field
 * turned into a plain named box, and exactly one unsigned signature field
 * declared for the organisation's seal. The fingerprint of that copy is the
 * request's document hash; nothing rewrites it afterwards but the incremental
 * update that seals it.
 */

import { Context, Data, type Effect } from 'effect'
import type { SignatureDocumentRefusalCode } from '@/domain/models/app/signatures/signature-request-service'

/** The document cannot be put to signature, for the reason `code` names. */
export class SignatureDocumentRefusal extends Data.TaggedError('SignatureDocumentRefusal')<{
  readonly code: SignatureDocumentRefusalCode
  readonly message: string
}> {}

/** The frozen copy of a document, and how many pages it shows. */
export interface PreparedSignatureDocument {
  readonly bytes: Uint8Array
  readonly pages: number
}

export class SignatureDocumentIntake extends Context.Service<
  SignatureDocumentIntake,
  {
    readonly prepare: (
      bytes: Uint8Array
    ) => Effect.Effect<PreparedSignatureDocument, SignatureDocumentRefusal>
  }
>()('SignatureDocumentIntake') {}
