/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What binds a signed upload: the constraints baked into its token — clamped
 * to the bucket's size cap and type list, carrying the signer. Pure, so the
 * sign route and an automation minting an upload link bind the same way; the
 * rule that a signed upload writes a new object, never over a stored one, is
 * enforced by each caller against the catalog, and again at `PUT`.
 */

import {
  isMimeTypeAllowed,
  resolveMaxFileSize,
} from '@/application/use-cases/buckets/upload-policy'
import type { Bucket } from '@/domain/models/app/buckets'

/** Default upload size limit when `maxSize` is not specified (10 MB). */
export const DEFAULT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024

/**
 * Upload constraints baked into an upload signed URL: the allowed `contentType`
 * (empty string means "any type the bucket accepts"), the `maxSize` in bytes —
 * never above the bucket's own cap — and `uploadedBy`, the signer the stored
 * object is attributed to. All are HMAC-bound so a client cannot relax them,
 * or re-attribute the object, by editing the query string.
 */
export interface UploadConstraints {
  readonly contentType: string
  readonly maxSize: number
  readonly uploadedBy?: string
}

/** Parsed body of a single-sign request. */
export interface SignRequestBody {
  readonly path?: unknown
  readonly operation?: unknown
  readonly expiresIn?: unknown
  readonly contentType?: unknown
  readonly maxSize?: unknown
}

/** Upload constraints carrying the signer, when there is one. */
export const withUploader = (
  constraints: { readonly contentType: string; readonly maxSize: number },
  uploadedBy: string | undefined
): UploadConstraints => (uploadedBy === undefined ? constraints : { ...constraints, uploadedBy })

/**
 * Whether a signed `PUT`'s type is admitted. A bound type must match exactly;
 * with none bound, the bucket's own list decides — silence from the signer is
 * not "any type" when the bucket names its types.
 */
export const uploadTypeAllowed = (bucket: Bucket, bound: string, requestType: string): boolean =>
  bound !== '' ? requestType === bound : isMimeTypeAllowed(bucket, requestType)

/** A requested `maxSize`: absent, a positive finite number, or `'invalid'`. */
const parseRequestedMaxSize = (maxSize: unknown): number | undefined | 'invalid' => {
  if (maxSize === undefined || maxSize === null) return undefined
  return typeof maxSize === 'number' && Number.isFinite(maxSize) && maxSize > 0
    ? maxSize
    : 'invalid'
}

/**
 * The size a signed upload is bound to: what the caller asked for (10 MB when
 * nothing), never above the bucket's effective cap — its `maxFileSize`, else
 * `STORAGE_MAX_FILE_SIZE`, else 100 MB, the rule the upload route applies. A
 * caller may narrow the cap, never widen it.
 */
export const clampUploadMaxSize = (requested: number | undefined, bucket: Bucket): number =>
  Math.min(requested ?? DEFAULT_UPLOAD_MAX_SIZE, resolveMaxFileSize(bucket)?.limit ?? Infinity)

/**
 * Resolve the upload constraints for a sign request body. Returns the
 * constraints to bake into the upload token, `'invalid'` when the request
 * specified an invalid `maxSize` or a non-text `contentType`, and
 * `'type-not-allowed'` when the type is one the bucket's `allowedMimeTypes`
 * refuses. A missing `contentType` is the empty string: the `PUT` then accepts
 * only the bucket's types.
 */
export function resolveUploadConstraints(
  body: SignRequestBody,
  bucket: Bucket,
  uploadedBy: string | undefined
): UploadConstraints | 'invalid' | 'type-not-allowed' {
  const { contentType } = body
  if (contentType !== undefined && typeof contentType !== 'string') return 'invalid'
  const requested = parseRequestedMaxSize(body.maxSize)
  if (requested === 'invalid') return 'invalid'
  const type = contentType ?? ''
  if (type !== '' && !isMimeTypeAllowed(bucket, type)) return 'type-not-allowed'
  return withUploader(
    { contentType: type, maxSize: clampUploadMaxSize(requested, bucket) },
    uploadedBy
  )
}

/**
 * Resolve the upload constraints for an upload sign request. Download requests
 * carry no constraints (`undefined`).
 */
export function constraintsForSign(
  operation: 'download' | 'upload',
  body: SignRequestBody,
  signer: { readonly bucket: Bucket; readonly uploadedBy: string | undefined }
): UploadConstraints | undefined | 'invalid' | 'type-not-allowed' {
  if (operation !== 'upload') return undefined
  return resolveUploadConstraints(body, signer.bucket, signer.uploadedBy)
}

/** The 400 a refused set of upload constraints earns, by reason. */
export const constraintRefusalMessage = (refusal: 'invalid' | 'type-not-allowed'): string =>
  refusal === 'invalid' ? 'Invalid maxSize value' : 'Content type not allowed'
