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
  min: Schema.optional(Schema.Finite.annotate({ description: 'Minimum value for slider' })),
  max: Schema.optional(Schema.Finite.annotate({ description: 'Maximum value for slider' })),
  step: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Step increment for slider' }),
      Schema.check(Schema.isGreaterThan(0))
    )
  ),
  showValue: Schema.optional(
    Schema.Boolean.annotate({ description: 'Display the current slider value' })
  ),
  defaultValue: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]).annotate({
      description: 'Default value for form controls (select, radio-group, slider, etc.)',
    })
  ),
} as const
