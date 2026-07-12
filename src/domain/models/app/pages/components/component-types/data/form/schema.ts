/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  type ConditionOperator,
  ConditionOperatorSchema,
  type VisibleWhen,
  VisibleWhenSchema,
  type VisibleWhenCondition,
  VisibleWhenConditionSchema,
} from '../../../../../../shared/visible-when'

export { ConditionOperatorSchema, VisibleWhenSchema, VisibleWhenConditionSchema }
export type { ConditionOperator, VisibleWhen, VisibleWhenCondition }


export const FormFieldControlSchema = Schema.Literal(
  'text',
  'email',
  'password',
  'number',
  'tel',
  'url',
  'textarea',
  'select'
).annotations({
  title: 'Form Field Control',
  description:
    'Explicit input control for an endpoint-bound form field (text/email/password/number/tel/url/textarea/select). Omitted for table-bound forms (control derived from the column type).',
})

export const FormFieldConfigSchema = Schema.Struct({
  field: Schema.String.annotations({
    description:
      'Field identifier: a table column name (table-bound form) OR the JSON body key (endpoint-bound form)',
  }),
  control: Schema.optional(FormFieldControlSchema),
  options: Schema.optional(
    Schema.Array(
      Schema.Struct({
        value: Schema.String.annotations({ description: 'Option value submitted on choice' }),
        label: Schema.optional(
          Schema.String.annotations({ description: 'Option display label (defaults to value)' })
        ),
      })
    ).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Dropdown options for a control: select field ({ value, label? })',
      })
    )
  ),
  label: Schema.optional(
    Schema.String.annotations({
      description: 'Custom label text (overrides default field name)',
    })
  ),
  placeholder: Schema.optional(
    Schema.String.annotations({
      description: 'Placeholder text shown when field is empty',
    })
  ),
  readOnly: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, field is displayed but not editable',
    })
  ),
  disabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, field input is disabled',
    })
  ),
  defaultValue: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean).annotations({
      description: 'Default value for create mode. Supports static values or $variable references.',
    })
  ),
  hidden: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, field value is submitted but input is not rendered',
    })
  ),
  visibleWhen: Schema.optional(VisibleWhenConditionSchema),
  requiredWhen: Schema.optional(VisibleWhenConditionSchema),
  disabledWhen: Schema.optional(VisibleWhenConditionSchema),

  accept: Schema.optional(
    Schema.String.annotations({
      description: 'Comma-separated MIME types or extensions (e.g. "image/*,.pdf")',
      examples: ['image/*', '.pdf,.doc,.docx', 'image/png,image/jpeg'],
    })
  ),
  dropZone: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, renders a drag-and-drop area for file uploads',
    })
  ),
  maxFiles: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Maximum number of files allowed (for multiple-attachments fields)',
        examples: [1, 5, 10],
      })
    )
  ),
}).annotations({
  title: 'Form Field Config',
  description: 'Per-field configuration for a form component',
})


export const FormLayoutSchema = Schema.Literal('single-column', 'two-column', 'custom').annotations(
  {
    title: 'Form Layout',
    description: 'Layout mode for form fields (default: single-column)',
  }
)


export const FormFieldGroupSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Group label displayed as a section divider above the fields',
  }),
  fields: Schema.Array(Schema.String).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Array of field names belonging to this group',
    })
  ),
}).annotations({
  title: 'Form Field Group',
  description: 'Groups form fields under a labeled section divider',
})


export type FormFieldControl = Schema.Schema.Type<typeof FormFieldControlSchema>
export type FormFieldConfig = Schema.Schema.Type<typeof FormFieldConfigSchema>
export type FormLayout = Schema.Schema.Type<typeof FormLayoutSchema>
export type FormFieldGroup = Schema.Schema.Type<typeof FormFieldGroupSchema>
