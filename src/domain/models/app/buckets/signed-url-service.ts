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
 * (the empty string means "any type the bucket accepts") and the `maxSize` in
 * bytes — plus `uploadedBy`, the id of the signed-in person who SIGNED it. The
 * `PUT` that follows carries no session, so the URL itself is the only thing
 * that can say whose object the bytes become; binding the id into the token is
 * what stops a holder from re-attributing them by editing the query.
 */
export interface SignedUrlUploadConstraints {
  readonly contentType: string
  readonly maxSize: number
  readonly uploadedBy?: string
}

/**
 * The scope a download link minted by an automation step carries: the object
 * it names is reached as the automation's own `file` actions reach it, with no
 * bucket of its own. No sign route mints it, so a link signed for a bucket can
 * never be turned into one.
 */
export type SignedUrlScope = 'automation'

/**
 * Everything a signed-URL token is bound to. Changing any of these values
 * changes the token, so a holder cannot widen a URL by editing its query.
 * `constraints` only counts for an upload, and `scope` only for a download.
 */
export interface SignedUrlClaims {
  readonly bucket: string
  readonly path: string
  readonly operation: SignedUrlOperation
  readonly expires: number
  readonly constraints?: SignedUrlUploadConstraints
  readonly scope?: SignedUrlScope
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
  const scope = claims.operation === 'download' ? claims.scope : undefined
  return JSON.stringify([
    claims.bucket,
    claims.path,
    claims.operation,
    claims.expires,
    // An absent constraint is `undefined`, which JSON renders as `null` in an array.
    constraints?.contentType,
    constraints?.maxSize,
    // Appended only when present, so every token minted without a signer —
    // every download, an anonymous upload — keeps its exact former payload.
    // The array LENGTH then differs, so the two shapes can never collide.
    ...(constraints?.uploadedBy === undefined ? [] : [constraints.uploadedBy]),
    // A scoped download appends its scope the same way: an unscoped download
    // keeps its former payload, and the operation keeps the two appendices apart.
    ...(scope === undefined ? [] : [scope]),
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
