/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ToggleTypeSchema } from '../../form-controls'
import { ComponentSizeSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ToggleTypeLiteral = Schema.Literal('toggle')

export const toggleFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  pressed: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Default pressed/active state for toggle',
    })
  ),
  toggleType: Schema.optional(ToggleTypeSchema),
  size: Schema.optional(ComponentSizeSchema),
} as const
