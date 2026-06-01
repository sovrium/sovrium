/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FormNameSchema } from '../../../../../forms/name'
import { actionFields } from '../../modules/action'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { FormFieldConfigSchema, FormFieldGroupSchema } from './schema'

export const FormTypeLiteral = Schema.Literal('form')

export const DataFormTypeLiteral = Schema.Literal('data-form')

const InlinePrefillValueSchema = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Array(Schema.String),
  Schema.Array(Schema.Number)
).annotations({
  description:
    'Literal value or `$parent.<field>` token resolved against the host page record at render time.',
})

export const InlinePrefillSchema = Schema.Struct({
  prefill: Schema.Record({
    key: Schema.String,
    value: InlinePrefillValueSchema,
  }).annotations({
    description:
      'Map of form-field column name to prefill value. Supports `$parent.<field>` tokens that resolve against the host page record.',
  }),
  lockPrefill: Schema.optional(
    Schema.Boolean.annotations({
      description:
        'When true, prefilled fields render as hidden inputs and the server revalidates the parent on submit (returns 422 if the parent is gone).',
    })
  ),
}).annotations({
  identifier: 'InlinePrefill',
  title: 'Inline Prefill',
  description:
    'Auto-prefill relationship/scalar fields on an embedded form using values from the host page record.',
})

export const formFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...actionFields,
  ...i18nFields,
  ...dataBoundFields,
  wizard: Schema.optional(
    Schema.Struct({
      steps: Schema.NonEmptyArray(
        Schema.Struct({
          label: Schema.String.annotations({
            description: 'Step label shown in the progress indicator',
          }),
          fields: Schema.NonEmptyArray(Schema.String).annotations({
            description: 'Field names assigned to this step',
          }),
        })
      ).annotations({ description: 'Ordered list of wizard steps' }),
    }).annotations({
      description:
        'Multi-step wizard configuration. Splits form fields into sequential steps with Next/Back navigation.',
    })
  ),
  formRef: Schema.optional(
    FormNameSchema.annotations({
      description:
        'Reference a top-level form by name (app.forms[].name). Renders that form inline.',
    })
  ),
  inlinePrefill: Schema.optional(InlinePrefillSchema),
  fields: Schema.optional(
    Schema.Array(FormFieldConfigSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description:
          'Per-field configuration for form component (labels, placeholders, visibility)',
      })
    )
  ),
  fieldGroups: Schema.optional(
    Schema.Array(FormFieldGroupSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Groups form fields under labeled section dividers' })
    )
  ),
  layout: Schema.optional(
    Schema.Literal('single-column', 'two-column', 'custom').annotations({
      description: 'Form layout mode: single-column | two-column | custom',
    })
  ),
} as const

export * from './schema'
