/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema, FetchSuccessResponseSchema, FetchToastResponseSchema } from '../../action'
import { actionFields } from '../modules/action'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const FileUploadTypeLiteral = Schema.Literal('file-upload')

/**
 * `uploadAction` accepts either:
 * - A string URL (e.g. "/api/buckets/default/files") for direct uploads to a
 *   bucket endpoint, or
 * - An `ActionSchema` object for richer flows (CRUD, automation, etc.).
 *
 * The string form is the common case for the basic upload button and the
 * dropzone variant.
 */
export const FileUploadActionSchema = Schema.Union([Schema.String, ActionSchema]).annotate({
  title: 'Upload Action',
  description:
    'Upload destination — either a URL string (e.g. "/api/buckets/default/files") or an Action object',
})

export const fileUploadFields = {
  ...coreFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  accept: Schema.optional(
    Schema.String.annotate({
      description: 'Accepted file types as MIME types or extensions (e.g. "image/*, .pdf")',
    })
  ),
  dropZone: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Enable drag-and-drop dropzone area for uploads',
    })
  ),
  maxFiles: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Maximum number of files allowed per upload' })
    )
  ),
  maxFileSize: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.annotate({
        description: 'Maximum file size in bytes (e.g. 10485760 for 10MB)',
      })
    )
  ),
  uploadAction: Schema.optional(FileUploadActionSchema),
  /**
   * Success handler dispatched after a successful multipart upload (a 2xx
   * response from `uploadAction`). Reuses the shipped fetch-action effects
   * shape (`FetchSuccessResponseSchema`) so the SAME client mechanism
   * (`applyFetchSuccessEffects`) that powers a `fetch` action's `onSuccess`
   * runs here too:
   *  - `toast`: a transient success notification;
   *  - `status`: a PERSISTENT inline `role="status"` region (the lasting
   *    "Fichier ajouté" badge);
   *  - `refetch`: re-query sibling data-bound component(s) by `props.id` — so
   *    a sibling list (a DB-table `dataSource` OR a `dataSource.system` read
   *    endpoint) reflects the just-uploaded file WITHOUT a full reload. This is
   *    what lets a config page compose `file-upload` + a sibling file
   *    `data-table` into a self-refreshing browse-and-upload surface.
   *
   * @example
   * ```yaml
   * - type: file-upload
   *   uploadAction: /api/buckets/uploads/files
   *   onSuccess:
   *     type: toast
   *     variant: success
   *     message: Fichier ajouté
   *     refetch: files-grid          # re-query the sibling file data-table
   * ```
   */
  onSuccess: Schema.optional(FetchSuccessResponseSchema),
  /**
   * Error handler dispatched when the upload resolves with a non-2xx response
   * or rejects (a rejected MIME type, an oversized file, a storage failure).
   * Reuses the fetch-action toast-response shape (`FetchToastResponseSchema`).
   */
  onError: Schema.optional(FetchToastResponseSchema),
} as const
