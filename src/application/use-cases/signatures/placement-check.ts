/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Check, at send, that the frozen copy can hold every signer's mark.
 *
 * Run on the frozen copy, after the intake rewrote it and before anything is
 * stored or mailed: a refused placement starts no request. A flow whose
 * signers place no mark reads nothing.
 */

import { Data, Effect } from 'effect'
import { SignaturePdf } from '@/application/ports/services/signature-pdf'
import {
  placementRefusalOf,
  placesAnyMark,
  type SignaturePlacementRefusalCode,
} from '@/domain/models/app/signatures/signature-placement-service'
import type { SignatureFlow } from '@/domain/models/app/signatures/signature'

/** A signer's mark cannot be placed on the document, for the reason `code` names. */
export class SignaturePlacementRefusal extends Data.TaggedError('SignaturePlacementRefusal')<{
  readonly code: SignaturePlacementRefusalCode
  readonly message: string
}> {}

/** Refuse the send when the frozen copy cannot hold a signer's placement. */
export const checkSignerPlacements = (flow: SignatureFlow, frozen: Uint8Array) =>
  Effect.gen(function* () {
    if (!placesAnyMark(flow.signers)) return
    const layout = yield* (yield* SignaturePdf).layout(frozen)
    const refusal = placementRefusalOf(flow.signers, layout)
    if (refusal !== undefined) return yield* new SignaturePlacementRefusal(refusal)
  }).pipe(Effect.withSpan('signatures.check-placements', { attributes: { flow: flow.name } }))
