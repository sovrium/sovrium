/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../form-field-props'

/**
 * Standalone field input types — used when a form is NOT bound to a table.
 * Mirrors the table field types where the rendering is similar but the value
 * is not persisted into a column directly.
 */
export const StandaloneInputTypeSchema = Schema.Literals([
  'short-text',
  'long-text',
  'email',
  'url',
  'phone',
  'number',
  'date',
  'datetime',
  'select',
  'multi-select',
  'checkbox',
  'radio',
  'rating',
  'attachment',
]).annotate({
  identifier: 'StandaloneInputType',
  title: 'Standalone Input Type',
  description: 'Input control type for standalone (non-table-bound) fields',
})

/**
 * Standalone field — typed inline, not persisted as a column. Useful for
 * forms that route only to automations or the submission ledger.
 */
export const StandaloneFieldSchema = Schema.Struct({
  kind: Schema.Literal('standalone').annotate({
    description: 'Which kind of field this is. It decides which of the other keys apply.',
  }),
  /** Field name unique within the form. */
  name: Schema.String.annotate({
    description:
      'Identifier for this field within the form; it is the key the answer is stored and reported under.',
  }).pipe(Schema.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/), Schema.isMaxLength(64))),
  /** Input control type. */
  inputType: StandaloneInputTypeSchema,
  /** Choices for select / multi-select / radio fields. */
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        value: Schema.String.annotate({
          description: 'Value stored when this choice is selected.',
        }),
        label: Schema.optional(
          Schema.String.annotate({
            description: 'Text shown for this choice; the value itself is shown when omitted.',
          })
        ),
      }).annotate({
        description: 'One choice: the value it stores, and the text it shows.',
      })
    ).annotate({
      description: 'Choices offered by a select, multi-select or radio field.',
    })
  ),
  /** Accepted MIME types for attachment fields. */
  accept: Schema.optional(
    Schema.String.annotate({
      description: 'Comma-separated MIME types or file extensions the file picker accepts.',
    })
  ),
  /** Max files for attachment fields. */
  maxFiles: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Largest number of files the person may attach.' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Maximum file size (bytes) for each uploaded file. */
  maxFileSize: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Largest size, in bytes, accepted for each uploaded file.' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Render a drag-and-drop zone alongside the file picker. */
  dropZone: Schema.optional(
    Schema.Boolean.annotate({ description: 'Shows a drag-and-drop area next to the file picker.' })
  ),
  ...commonFieldProps,
}).annotate({
  identifier: 'StandaloneField',
  title: 'Standalone Form Field',
  description: 'Form field typed inline (not bound to a table column)',
})

/** @public */
export type StandaloneInputType = Schema.Schema.Type<typeof StandaloneInputTypeSchema>
export type StandaloneField = Schema.Schema.Type<typeof StandaloneFieldSchema>
