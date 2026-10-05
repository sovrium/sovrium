/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** What a signed URL lets its holder do with the one object it names. */
export type SignedUrlOperation = 'download' | 'upload'

/**
 * The upload limits a signed upload URL carries: the allowed `contentType`
 * (the empty string means "any") and the `maxSize` in bytes.
 */
export interface SignedUrlUploadConstraints {
  readonly contentType: string
  readonly maxSize: number
}

/**
 * Everything a signed-URL token is bound to. Changing any of these values
 * changes the token, so a holder cannot widen a URL by editing its query.
 * `constraints` only counts for an upload: a download is signed without them.
 */
export interface SignedUrlClaims {
  readonly bucket: string
  readonly path: string
  readonly operation: SignedUrlOperation
  readonly expires: number
  readonly constraints?: SignedUrlUploadConstraints
}

/**
 * The exact bytes a token signs: the claims as one JSON array, in a fixed
 * order, with the upload constraints rendered `null` when absent.
 *
 * The encoding is UNAMBIGUOUS on purpose. The previous payload joined the
 * fields with `|`, and a storage key may itself contain `|`, so the download
 * claims for the key `report.pdf|upload|99999999999999` produced the very same
 * string as upload claims for `report.pdf` — one token, verifying as both. JSON
 * quotes and escapes every string, so no value can spill into its neighbour and
 * two different claim sets never share a payload.
 */
export const signedUrlPayload = (claims: SignedUrlClaims): string => {
  const constraints = claims.operation === 'upload' ? claims.constraints : undefined
  return JSON.stringify([
    claims.bucket,
    claims.path,
    claims.operation,
    claims.expires,
    // An absent constraint is `undefined`, which JSON renders as `null` in an array.
    constraints?.contentType,
    constraints?.maxSize,
  ])
}

/**
 * The token for a set of claims: the HMAC-SHA256 of {@link signedUrlPayload}
 * under `secret`, rendered as 64 lowercase hex characters. The one signer
 * every place that mints a storage URL goes through, so a token minted by one
 * always verifies through the other.
 */
export const signSignedUrl = (secret: string, claims: SignedUrlClaims): string =>
  createHmac('sha256', secret).update(signedUrlPayload(claims)).digest('hex')

/**
 * The only shape a token can have: exactly 64 lowercase hex characters, as
 * `digest('hex')` renders it. Uppercase is refused on purpose — no minted
 * token contains it, so accepting it would only widen the set of strings that
 * verify.
 */
const SIGNED_URL_TOKEN_PATTERN = /^[0-9a-f]{64}$/

/**
 * Whether a client-supplied token is the one {@link signSignedUrl} mints for
 * these claims. The candidate is shape-checked before any comparison, so both
 * sides are then 64 ASCII bytes and the constant-time compare cannot throw on
 * a length mismatch (which once turned a refusal into a server error).
 */
export const verifySignedUrl = (
  secret: string,
  claims: SignedUrlClaims,
  candidate: string
): boolean =>
  SIGNED_URL_TOKEN_PATTERN.test(candidate) &&
  timingSafeEqual(Buffer.from(signSignedUrl(secret, claims)), Buffer.from(candidate))
