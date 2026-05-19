/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DatePickerModeSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const DatePickerTypeLiteral = Schema.Literal('date-picker')

export const datePickerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  dateFormat: Schema.optional(
    Schema.String.annotations({
      description: 'Date format string (e.g. "YYYY-MM-DD", "MM/DD/YYYY")',
    })
  ),
  minDate: Schema.optional(
    Schema.String.annotations({ description: 'Minimum selectable date (ISO 8601)' })
  ),
  maxDate: Schema.optional(
    Schema.String.annotations({ description: 'Maximum selectable date (ISO 8601)' })
  ),
  datePickerMode: Schema.optional(DatePickerModeSchema),
} as const
