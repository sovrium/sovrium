/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OptionsSchema, OrientationSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const RadioGroupTypeLiteral = Schema.Literal('radio-group')

export const radioGroupFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  options: Schema.optional(OptionsSchema),
  orientation: Schema.optional(OrientationSchema),
  defaultValue: Schema.optional(
    Schema.Union(Schema.String, Schema.Number, Schema.Boolean).annotations({
      description: 'Default value for form controls (select, radio-group, slider, etc.)',
    })
  ),
} as const
