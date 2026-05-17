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
    Schema.String.annotations({ description: 'Label text for the composed form field' })
  ),
  fieldDescription: Schema.optional(
    Schema.String.annotations({
      description: 'Help text displayed below the form control',
    })
  ),
  fieldError: Schema.optional(
    Schema.String.annotations({
      description: 'Error message displayed below the form control',
    })
  ),
  required: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Show required indicator on the field label',
    })
  ),
} as const
