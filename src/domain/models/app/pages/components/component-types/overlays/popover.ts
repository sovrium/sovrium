/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { FloatingSideSchema, FloatingAlignSchema } from '../../shared-schemas'
import { contentFields } from '../modules/content'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const PopoverTypeLiteral = Schema.Literal('popover')

export const popoverFields = {
  ...coreFields,
  ...contentFields,
  ...visibilityFields,
  ...i18nFields,
  floatingSide: Schema.optional(FloatingSideSchema),
  floatingAlign: Schema.optional(FloatingAlignSchema),
} as const
