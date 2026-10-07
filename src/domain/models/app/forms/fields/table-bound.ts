/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SelectOptionSourceSchema } from '../../table-option-source'
import { commonFieldProps, FormRecordAudioSchema } from '../form-field-props'

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
  kind: Schema.Literal('table-field').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  /** Column name on `submitTo.table`. */
  column: Schema.String.annotate({
    description: "Name of the column on the form's target table that this field reads and writes.",
  }).pipe(Schema.check(Schema.isMinLength(1))),
  /**
   * Override for the choices a `relationship` column offers. Without one, the
   * field lists the related table's rows labelled by the column's
   * `displayField` and stores the row id; refused on any other column type
   * (`form-option-source-validation.ts`).
   */
  optionsSource: Schema.optional(
    SelectOptionSourceSchema.annotate({
      description:
        "Overrides the choices a `relationship` column offers (by default its related table's rows, labelled by the column's `displayField`). Reads this field's choices from a table's rows each time the form is served: `displayField` is shown, `valueField` (default `id`) is stored. Resolved on the server with the form's own authority, so a public form needs no read permission on the table; only those two columns reach the page. Mutually exclusive with `options`.",
    })
  ),
  /** Comma-separated MIME types or extensions for attachment inputs. */
  accept: Schema.optional(
    Schema.String.annotate({
      description:
        "Comma-separated MIME types or file extensions the file picker accepts. Enforced again on submission, on the file's content as well as its declared type: a file outside the list is refused with 400, and `image/*` does not admit SVG unless `image/svg+xml` or `.svg` is named.",
    })
  ),
  /** Maximum file size (bytes) for each uploaded file. */
  maxFileSize: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          "Largest size, in bytes, accepted for each uploaded file. Enforced again on submission: a larger file is refused with 413. The bucket's own limit applies too.",
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Maximum number of files for `multiple-attachments` columns. */
  maxFiles: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Largest number of files the person may attach, for a multiple-attachments column.',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Render a drag-and-drop zone alongside the file picker. */
  dropZone: Schema.optional(
    Schema.Boolean.annotate({ description: 'Shows a drag-and-drop area next to the file picker.' })
  ),
  /** In-browser microphone recorder for attachment fields. */
  recordAudio: Schema.optional(FormRecordAudioSchema),
  ...commonFieldProps,
}).annotate({
  identifier: 'TableBoundField',
  title: 'Table-Bound Form Field',
  description: 'Form field bound to a column on submitTo.table',
})

export type TableBoundField = Schema.Schema.Type<typeof TableBoundFieldSchema>
