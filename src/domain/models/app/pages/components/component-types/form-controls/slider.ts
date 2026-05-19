/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const SliderTypeLiteral = Schema.Literal('slider')

export const sliderFields = {
  ...coreFields,
  ...visibilityFields,
  min: Schema.optional(Schema.Number.annotations({ description: 'Minimum value for slider' })),
  max: Schema.optional(Schema.Number.annotations({ description: 'Maximum value for slider' })),
  step: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Step increment for slider' })
    )
  ),
  showValue: Schema.optional(
    Schema.Boolean.annotations({ description: 'Display the current slider value' })
  ),
  defaultValue: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean).annotations({
      description: 'Default value for form controls (select, radio-group, slider, etc.)',
    })
  ),
} as const
