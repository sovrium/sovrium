/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * API contract for `POST /api/signatures/requests/:requestId/erasures` — the
 * operator erases one signer of a request on her request.
 *
 * Her contact details and the salts that tie her to the log are deleted, her
 * signature cell is redacted (the mark and her name removed, the statement and
 * method kept), and an `erased` event is appended. The chain still verifies;
 * its commitments no longer identify her. Admin only; anyone else gets 404.
 */

export const erasureRequestSchema = Schema.Struct({
  signer: Schema.String.annotate({ description: 'Name of the signer within the flow' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
}).annotate({ identifier: 'SignatureErasureRequest' })

/** @public */
export type ErasureRequest = typeof erasureRequestSchema.Type

export const erasureResponseSchema = Schema.Struct({
  erased: Schema.Literal(true),
  signer: Schema.String.annotate({ description: 'The signer erased' }),
}).annotate({ identifier: 'SignatureErasureResponse' })
