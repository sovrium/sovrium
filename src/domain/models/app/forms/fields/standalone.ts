/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { commonFieldProps } from '../../../shared/form-field-props'

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

export const StandaloneFieldSchema = Schema.Struct({
  kind: Schema.Literal('standalone'),
  name: Schema.String.pipe(Schema.pattern(/^[a-zA-Z][a-zA-Z0-9_-]*$/), Schema.maxLength(64)),
  inputType: StandaloneInputTypeSchema,
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        value: Schema.String,
        label: Schema.optional(Schema.String),
      })
    )
  ),
  accept: Schema.optional(Schema.String),
  maxFiles: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  maxFileSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))),
  dropZone: Schema.optional(Schema.Boolean),
  ...commonFieldProps,
}).annotations({
  identifier: 'StandaloneField',
  title: 'Standalone Form Field',
  description: 'Form field typed inline (not bound to a table column)',
})

export type StandaloneInputType = Schema.Schema.Type<typeof StandaloneInputTypeSchema>
export type StandaloneField = Schema.Schema.Type<typeof StandaloneFieldSchema>
