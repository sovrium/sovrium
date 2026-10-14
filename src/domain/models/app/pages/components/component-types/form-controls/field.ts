/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const FieldTypeLiteral = Schema.Literal('field')

export const fieldFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  fieldLabel: Schema.optional(
    Schema.String.annotate({ description: 'Label text for the composed form field' })
  ),
  fieldDescription: Schema.optional(
    Schema.String.annotate({
      description: 'Help text displayed below the form control',
    })
  ),
  fieldError: Schema.optional(
    Schema.String.annotate({
      description: 'Error message displayed below the form control',
    })
  ),
  required: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Show required indicator on the field label',
    })
  ),
  orientation: Schema.optional(
    Schema.Literals(['vertical', 'horizontal', 'responsive']).annotate({
      title: 'Orientation',
      defaultNote: 'vertical',
      description:
        "Where the label sits: 'vertical' (above the control), 'horizontal' (beside it) or 'responsive' (beside it on a wide screen, above it on a narrow one). shadcn/ui's Field orientation.",
    })
  ),
  errors: Schema.optional(
    Schema.Array(Schema.String).annotate({
      title: 'Errors',
      description:
        'Several error messages, drawn as one list under the control, which is marked invalid. Beside `fieldError`, which draws one.',
    })
  ),
  legend: Schema.optional(
    Schema.String.annotate({
      title: 'Legend',
      description:
        "Makes the field a fieldset named by this legend, its children grouped inside it — an address's street and city. shadcn/ui's FieldSet and FieldLegend.",
    })
  ),
  fieldTitle: Schema.optional(
    Schema.String.annotate({
      title: 'Field Title',
      description:
        "A title drawn beside a choice control (a switch, a checkbox), above `fieldDescription`, naming the control. shadcn/ui's FieldTitle in FieldContent.",
    })
  ),
} as const
