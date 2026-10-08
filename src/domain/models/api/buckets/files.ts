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
      'The stored object key — the original filename behind a generated prefix. Later calls (download, delete, a deploy intake) name the object by this key.',
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
