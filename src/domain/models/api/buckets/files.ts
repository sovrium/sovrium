/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `POST /api/buckets/:bucketName/files` — the public upload
 * route of a configured bucket.
 *
 * The request is `multipart/form-data` with one `file` part, so only the 201
 * answer is modelled. It is the flat object the route writes: the stored
 * object key (a `<uuid>-<filename>` key the caller names in later calls), the
 * stored byte count, the MIME type and the original filename. The admin
 * file browser's upload (`../admin/buckets/upload.ts`) answers a different,
 * enveloped shape and is not this contract.
 */

import { Schema } from 'effect'

/**
 * Response schema for `POST /api/buckets/:bucketName/files` (HTTP 201).
 */
export const bucketUploadResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({
    description: 'Always `true` on the 201 answer; a refusal answers an error body instead.',
  }),
  key: Schema.String.annotate({
    description:
      'The stored object key: the original filename behind a generated prefix. Later calls (download, delete, a deploy intake) name the object by this key.',
  }).check(Schema.isMinLength(1)),
  size: Schema.Number.annotate({ description: 'The number of bytes stored.' }).check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0)
  ),
  mimeType: Schema.String.annotate({
    description: 'The MIME type the file was stored with, as accepted by the bucket.',
  }),
  filename: Schema.String.annotate({
    description: 'The filename the uploaded part carried.',
  }),
}).annotate({ identifier: 'BucketUploadResponse' })

/** @public */
export type BucketUploadResponse = typeof bucketUploadResponseSchema.Type

/**
 * `POST /api/buckets/:bucketName/sign`: one signed URL.
 */
export const signedUrlResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'The URL was signed' }),
  signedUrl: Schema.String.annotate({
    description: 'The URL to read from or write to, valid until `expiresAt`',
  }),
  expiresAt: Schema.String.annotate({ description: 'When the URL stops working (ISO 8601)' }),
  operation: Schema.Literals(['download', 'upload']).annotate({
    description: 'What the URL allows',
  }),
}).annotate({ identifier: 'SignedUrlResponse' })

/** @public */
export type SignedUrlResponse = typeof signedUrlResponseSchema.Type

/**
 * `PUT /api/buckets/:bucketName/signed`: the file sent to a signed upload URL
 * is stored.
 */
export const signedUploadResponseSchema = Schema.Struct({
  success: Schema.Literal(true).annotate({ description: 'The file was stored' }),
  path: Schema.String.annotate({ description: 'The key the file is stored under' }),
}).annotate({ identifier: 'SignedUploadResponse' })

/** @public */
export type SignedUploadResponse = typeof signedUploadResponseSchema.Type

/**
 * `POST /api/buckets/:bucketName/sign/batch`: one answer per file, in request
 * order. A file that cannot be signed names why and does not fail the others.
 */
export const signedUrlBatchResponseSchema = Schema.Struct({
  results: Schema.Array(
    Schema.Union([
      Schema.Struct({
        path: Schema.String.annotate({ description: 'The path that was signed' }),
        signedUrl: Schema.String.annotate({
          description: 'The URL to read from or write to, valid until `expiresAt`',
        }),
        expiresAt: Schema.String.annotate({ description: 'When the URL stops working (ISO 8601)' }),
      }),
      Schema.Struct({
        path: Schema.String.annotate({ description: 'The path that could not be signed' }),
        error: Schema.Literals(['not_found', 'conflict']).annotate({
          description:
            'not_found: a download of a file that does not exist; conflict: an upload to a key that holds a file',
        }),
      }),
    ])
  ).annotate({ description: 'One answer per requested file, in request order' }),
}).annotate({ identifier: 'SignedUrlBatchResponse' })

/** @public */
export type SignedUrlBatchResponse = typeof signedUrlBatchResponseSchema.Type
