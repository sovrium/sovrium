/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TimeFormatSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const TimePickerTypeLiteral = Schema.Literal('time-picker')

export const timePickerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  timeFormat: Schema.optional(TimeFormatSchema),
  minTime: Schema.optional(
    Schema.String.annotations({
      description: 'Minimum selectable time in HH:mm format',
    })
  ),
  maxTime: Schema.optional(
    Schema.String.annotations({
      description: 'Maximum selectable time in HH:mm format',
    })
  ),
  minuteStep: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Minute increment for time selection (default: 15)',
      })
    )
  ),
} as const
