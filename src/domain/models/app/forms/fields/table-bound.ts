/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../../../shared/form-field-props'

/**
 * Table-bound field — references a column on the form's `submitTo.table`.
 * Field type, validation, and persistence all flow from the table schema;
 * the form only overrides display concerns (label, placeholder, help text).
 *
 * For attachment-typed columns (`single-attachment`, `multiple-attachments`),
 * the form-renderer projects the column type onto a `<input type="file">`
 * element and the inline runtime drives a multipart pre-upload + canonical
 * `{ url, name, size, mimeType }` metadata write. The optional `accept`,
 * `maxFileSize`, `maxFiles`, and `dropZone` props mirror the in-page
 * `FormFieldConfigSchema` so the same upload UX applies whether the form
 * is rendered as a top-level standalone form or expanded inside a host
 * page via `formRef`.
 */
export const TableBoundFieldSchema = Schema.Struct({
  kind: Schema.Literal('table-field'),
  /** Column name on `submitTo.table`. */
  column: Schema.String.pipe(Schema.minLength(1)),
  /** Comma-separated MIME types or extensions for attachment inputs. */
  accept: Schema.optional(Schema.String),
  /** Maximum file size (bytes) for each uploaded file. */
  maxFileSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  /** Maximum number of files for `multiple-attachments` columns. */
  maxFiles: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  /** Render a drag-and-drop zone alongside the file picker. */
  dropZone: Schema.optional(Schema.Boolean),
  ...commonFieldProps,
}).annotations({
  identifier: 'TableBoundField',
  title: 'Table-Bound Form Field',
  description: 'Form field bound to a column on submitTo.table',
})

export type TableBoundField = Schema.Schema.Type<typeof TableBoundFieldSchema>
