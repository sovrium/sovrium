/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RecordLookupDefaultSchema, SelectOptionSourceSchema } from '../../table-option-source'
import {
  commonFieldProps,
  FormFieldAutocompleteSchema,
  FormRecordAudioSchema,
} from '../form-field-props'

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
  /** Browser autofill hint; derived from the field's type when omitted. */
  autocomplete: Schema.optional(FormFieldAutocompleteSchema),
  /**
   * What the form says under this field when its value is already held by
   * another record of a `unique` column — shown to every submitter. Without
   * it, only a submitter who may read the record holding the value is told
   * under the field; anyone else reads the form's generic refusal.
   */
  takenMessage: Schema.optional(
    Schema.String.annotate({
      description:
        'Message shown under this field, to every submitter, when the value is already held by another record of a `unique` column — for instance "This email is already registered". Setting it tells anyone who submits the form that the value exists. Without it, the field-level message is shown only to a submitter who may read the record holding the value; anyone else, a visitor who is not signed in included, reads the form\'s generic refusal and no field is named. Nothing is stored either way.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  ...commonFieldProps,
  /**
   * Value the field starts with. Widens the common default with a `lookup`,
   * which a relationship column uses to preselect a related row by a stable
   * attribute rather than by an id that changes between environments.
   */
  defaultValue: Schema.optional(
    Schema.Union([
      Schema.String,
      Schema.Finite,
      Schema.Boolean,
      RecordLookupDefaultSchema,
    ]).annotate({
      description:
        'Value the field starts with: a literal, `$query.{name}` to read a URL parameter, `$user.{prop}` to read a property of the signed-in user, `$now` for the current date and time, or — on a relationship column — `{ lookup: { table, where: { field, operator, value } } }` to start on the related row meeting that condition, found each time the form is served. The form starts from it wherever it is shown, embedded in a page or on its own.',
    })
  ),
}).annotate({
  identifier: 'TableBoundField',
  title: 'Table-Bound Form Field',
  description: 'Form field bound to a column on submitTo.table',
})

export type TableBoundField = Schema.Schema.Type<typeof TableBoundFieldSchema>
