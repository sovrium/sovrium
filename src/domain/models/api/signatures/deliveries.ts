/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * API contract for `GET /api/signatures/deliveries/:token/:file` — a signer's
 * copy of a completed request's documents.
 *
 * At completion each signer who signed is mailed a link of her own, bound to
 * her alone by a token stored only as its digest and valid for
 * {@link DELIVERY_LINK_DAYS} days. It answers the signed document
 * (`signed.pdf`) or the proof file (`proof.pdf`) as `application/pdf`. An
 * unknown, expired or replaced token, a request that is not completed, and any
 * other file name all get the same 404, with no session asked for and none
 * consulted: the token is the whole authorisation.
 */

/** The route, as mounted. */
export const DELIVERY_ROUTE_PATH = '/api/signatures/deliveries/:token/:file'

/** How long a delivery link opens the documents, in days. */
export const DELIVERY_LINK_DAYS = 7

/** The files a delivery link opens. */
export const DELIVERED_FILES = ['signed.pdf', 'proof.pdf'] as const

export const deliveredFileSchema = Schema.Literals(DELIVERED_FILES).annotate({
  identifier: 'SignatureDeliveredFile',
  description: 'The signed document (signed.pdf) or the proof file (proof.pdf)',
})

/** @public */
export type DeliveredFile = typeof deliveredFileSchema.Type

/** The shape of a delivery token: 32 random bytes in base64url, 43 characters. */
export const deliveryTokenSchema = Schema.String.annotate({
  identifier: 'SignatureDeliveryToken',
  description: 'The token of a delivery link, 43 base64url characters',
}).pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)))
