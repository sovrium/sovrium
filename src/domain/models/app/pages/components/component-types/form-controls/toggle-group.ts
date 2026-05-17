/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OptionsSchema, OrientationSchema, ToggleTypeSchema } from '../../form-controls'
import { ComponentSizeSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ToggleGroupTypeLiteral = Schema.Literal('toggle-group')

export const toggleGroupFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  options: Schema.optional(OptionsSchema),
  orientation: Schema.optional(OrientationSchema),
  toggleType: Schema.optional(ToggleTypeSchema),
  size: Schema.optional(ComponentSizeSchema),
} as const
