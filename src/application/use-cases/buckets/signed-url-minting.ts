/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How Sovrium's own signed storage URLs are minted: the lifetime a URL may
 * have, the bucket a sign request addresses, and the URL itself —
 * `/api/buckets/<bucket>/signed?…`, its query HMAC-bound through the one
 * shared signer.
 *
 * Two roads mint them: the sign routes (`POST /api/buckets/:bucket/sign` and
 * its batch form), which take their origin from the request, and the
 * automation `file.signUrl` step, which has no request and takes it from
 * `BASE_URL`. Both go through {@link mintSignedUrl}, so a URL either hands out
 * is verified by the same `GET`/`PUT /signed` handler.
 */

import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { signSignedUrl } from '@/domain/models/app/buckets/signed-url-service'
import type { App } from '@/domain/models/app'
import type { Bucket } from '@/domain/models/app/buckets'
import type {
  SignedUrlOperation,
  SignedUrlScope,
  SignedUrlUploadConstraints,
} from '@/domain/models/app/buckets/signed-url-service'

/** Default signed-URL lifetime in seconds (1 hour). */
export const DEFAULT_SIGNED_URL_EXPIRES_IN = 3600

/** Shortest lifetime a signed URL may have, in seconds (one minute). */
export const MIN_SIGNED_URL_EXPIRES_IN = 60

/** Longest lifetime a signed URL may have, in seconds (seven days). */
export const MAX_SIGNED_URL_EXPIRES_IN = 604_800

/**
 * Normalize and validate a requested `expiresIn`. Returns the value to use, or
 * `undefined` when the request specified an out-of-range value.
 */
export function resolveExpiresIn(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return DEFAULT_SIGNED_URL_EXPIRES_IN
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined
  if (raw < MIN_SIGNED_URL_EXPIRES_IN || raw > MAX_SIGNED_URL_EXPIRES_IN) return undefined
  return raw
}

/**
 * Resolve the bucket config for a signed-URL request: a declared bucket, or the
 * built-in private `system` bucket.
 */
export function resolveSignBucket(app: App, bucketName: string | undefined): Bucket | undefined {
  const explicit = app.buckets?.find((b) => b.name === bucketName)
  if (explicit) return explicit
  return bucketName === SYSTEM_BUCKET_NAME ? { name: SYSTEM_BUCKET_NAME, public: false } : undefined
}

/** What one signed URL names and allows. */
export interface SignedUrlRequest {
  readonly bucket: string
  readonly path: string
  readonly operation: SignedUrlOperation
  readonly expiresInSeconds: number
  readonly constraints?: SignedUrlUploadConstraints
  /** A download an automation step hands out: see {@link SignedUrlScope}. */
  readonly scope?: SignedUrlScope
}

/**
 * Where and when a URL is minted: the storage signing secret, the current time
 * in epoch milliseconds, and the origin the URL is prefixed with — the empty
 * string for a URL from the site root.
 */
export interface SignedUrlMinting {
  readonly secret: string
  readonly now: number
  readonly origin: string
}

/**
 * Mint the signed URL for one path. Upload URLs carry their HMAC-bound `ct`
 * (content type), `max` (size limit) and, when there is one, `by` (signer)
 * constraints in the query string so the `PUT` handler can enforce them.
 */
export function mintSignedUrl(
  request: SignedUrlRequest,
  minting: SignedUrlMinting
): { readonly signedUrl: string; readonly expiresAt: string } {
  const { bucket, path, operation, expiresInSeconds, constraints, scope } = request
  const expires = minting.now + expiresInSeconds * 1000
  const token = signSignedUrl(minting.secret, {
    bucket,
    path,
    operation,
    expires,
    constraints,
    ...(scope === undefined ? {} : { scope }),
  })
  const params = new URLSearchParams({ path, op: operation, expires: String(expires), token })
  if (operation === 'download' && scope !== undefined) params.set('scope', scope)
  if (operation === 'upload' && constraints) {
    params.set('ct', constraints.contentType)
    params.set('max', String(constraints.maxSize))
    if (constraints.uploadedBy !== undefined) params.set('by', constraints.uploadedBy)
  }
  return {
    signedUrl: `${minting.origin}/api/buckets/${bucket}/signed?${params.toString()}`,
    expiresAt: new Date(expires).toISOString(),
  }
}
