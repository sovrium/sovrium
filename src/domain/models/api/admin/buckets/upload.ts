/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `POST /api/admin/buckets/:bucketName/files`.
 *
 * The bucket file browser's **admin upload** write endpoint — the missing
 * piece that wires the `/_admin/buckets/{name}` file browser's "Ajouter un
 * fichier" modal (built in [internal ref]) to a real backend. Until this ships, the
 * modal's `uploadFileToBucket()` helper returns `'unavailable'` and renders an
 * honest "coming soon" notice (see
 * `src/presentation/islands/admin/buckets/admin-bucket-upload-dialog.tsx`).
 *
 * Source story: [internal ref]
 *
 * **Request shape (NOT modelled here — multipart/form-data):** the endpoint
 * consumes a `multipart/form-data` body with a single `file` part (the binary
 * payload, carrying its own `filename` + `Content-Type`). This is the SAME
 * wire format the public upload route (`POST /api/buckets/:name/files`) already
 * accepts, so the admin browser reuses the proven multipart path rather than a
 * JSON+base64 body. There is no Zod *request* schema because Zod does not model
 * a binary multipart part — the route reads it with Hono's `c.req.parseBody()`
 * and asserts `file instanceof File` (see the upload route guidance in the
 * spec / handoff notes). A second optional `path` form field (a verbatim
 * storage key, no UUID prefix) MAY be supported later to mirror the public
 * route; it is intentionally out of scope for v1 of the admin upload.
 *
 * **Response shape (modelled here — S4):** on success the endpoint returns the
 * **created-file metadata** shaped through this model — never a raw
 * `system.file_storage_metadata` row and never a raw `StorageService`
 * internal. The `file` block is the EXACT same flat projection as a row in the
 * file browser's `GET …/files` list ({@link bucketFileItemSchema}:
 * `{ key, filename, size, mimeType, createdAt }`), so the browser's post-upload
 * refresh (driven by the `sovrium:crud-success` event) sees a shape identical
 * to the rows it already renders — no second mapping, no drift between the
 * upload echo and the list row.
 *
 * **Why a `{ success, file }` envelope (not the bare row):** the public upload
 * route already answers `201 { success: true, key, size, mimeType, filename }`,
 * so an admin caller (and the dialog's choke-point helper) expects a `success`
 * discriminant to branch on. Nesting the metadata under `file` (rather than
 * spreading it at the top level like the public route) keeps the created-file
 * shape a clean, reusable sub-object that is literally `bucketFileItemSchema` —
 * the same object the list returns — so the two endpoints share one row type.
 *
 * @see ./files.ts — the file-browser READ endpoint; `bucketFileItemSchema` (the
 *   created-file shape) and `bucketFilesResponseSchema` (the list this upload
 *   feeds into) both live there
 * @see ../../../../../presentation/api/routes/buckets.ts — the public upload
 *   route (`persistUpload`) whose multipart contract + storage-key convention
 *   (`<uuid>-<filename>`) this admin endpoint mirrors
 * @see ../audit-log/action-catalog.ts — the bucket domain keys every action on
 *   the singular `bucket` resource type (a future `bucket.file.uploaded` emit
 *   would too)
 */

import { z } from '@hono/zod-openapi'
import { bucketFileItemSchema } from './files'

/**
 * Response schema for `POST /api/admin/buckets/:bucketName/files` (HTTP 201).
 *
 * A `success: true` discriminant plus the created file's metadata, shaped as
 * the SAME flat row the file browser's `GET …/files` list returns
 * ({@link bucketFileItemSchema}). Reusing that schema guarantees the upload
 * echo and the list row never drift — the browser can prepend the returned
 * `file` straight into its rendered rows, or simply re-list (the file surfaces
 * because the upload registered it in `system.file_storage_metadata`, which the
 * list reads).
 */
export const bucketFileUploadResponseSchema = z
  .object({
    success: z
      .literal(true)
      .describe(
        'Discriminant — always `true` on the 201 success response. Lets the admin dialog branch on outcome the same way it does for the public upload route.'
      ),
    file: bucketFileItemSchema.describe(
      'The created file, as the SAME flat projection a `GET /api/admin/buckets/:bucketName/files` row carries (`{ key, filename, size, mimeType, createdAt }`). Sourced from the just-written `system.file_storage_metadata` row so the browser sees the canonical, list-consistent shape.'
    ),
  })
  .openapi('BucketFileUploadResponse')

/**
 * TypeScript type inferred from the response schema.
 * @public
 */
export type BucketFileUploadResponse = z.infer<typeof bucketFileUploadResponseSchema>
