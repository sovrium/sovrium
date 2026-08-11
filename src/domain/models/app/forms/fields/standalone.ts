/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../../../shared/form-field-props'

/**
 * Standalone field input types — used when a form is NOT bound to a table.
 * Mirrors the table field types where the rendering is similar but the value
 * is not persisted into a column directly.
 */
export const StandaloneInputTypeSchema = Schema.Literal(
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
  'attachment'
).annotations({
  identifier: 'StandaloneInputType',
  title: 'Standalone Input Type',
  description: 'Input control type for standalone (non-table-bound) fields',
})

/**
 * Standalone field — typed inline, not persisted as a column. Useful for
 * forms that route only to automations or the submission ledger.
 */
export const StandaloneFieldSchema = Schema.Struct({
  kind: Schema.Literal('standalone'),
  /** Field name unique within the form. */
  name: Schema.String.pipe(Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/), Schema.maxLength(64)),
  /** Input control type. */
  inputType: StandaloneInputTypeSchema,
  /** Choices for select / multi-select / radio fields. */
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        value: Schema.String,
        label: Schema.optional(Schema.String),
      })
    )
  ),
  /** Accepted MIME types for attachment fields. */
  accept: Schema.optional(Schema.String),
  /** Max files for attachment fields. */
  maxFiles: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  /** Maximum file size (bytes) for each uploaded file. */
  maxFileSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  /** Render a drag-and-drop zone alongside the file picker. */
  dropZone: Schema.optional(Schema.Boolean),
  ...commonFieldProps,
}).annotations({
  identifier: 'StandaloneField',
  title: 'Standalone Form Field',
  description: 'Form field typed inline (not bound to a table column)',
})

/** @public */
export type StandaloneInputType = Schema.Schema.Type<typeof StandaloneInputTypeSchema>
export type StandaloneField = Schema.Schema.Type<typeof StandaloneFieldSchema>
