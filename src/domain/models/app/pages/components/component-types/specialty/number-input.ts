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

export const NumberInputTypeLiteral = Schema.Literal('number-input')

export const numberInputFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  min: Schema.optional(
    Schema.Finite.annotate({
      description: 'Minimum value for number input',
    })
  ),
  max: Schema.optional(
    Schema.Finite.annotate({
      description: 'Maximum value for number input',
    })
  ),
  step: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Step increment for number input' })
    )
  ),
  showStepper: Schema.optional(
    Schema.Boolean.annotate({
      description: 'Show increment/decrement stepper buttons (default: true)',
    })
  ),
  defaultValue: Schema.optional(
    Schema.Finite.annotate({
      description: 'Initial numeric value rendered in the input',
    })
  ),
} as const
