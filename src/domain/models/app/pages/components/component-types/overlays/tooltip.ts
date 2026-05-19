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

export const TooltipTypeLiteral = Schema.Literal('tooltip')

export const tooltipFields = {
  ...coreFields,
  ...contentFields,
  ...i18nFields,
  tooltipContent: Schema.optional(
    Schema.String.annotations({ description: 'Text content displayed in the tooltip' })
  ),
  tooltipDelay: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.annotations({ description: 'Delay in milliseconds before showing tooltip' })
    )
  ),
  floatingSide: Schema.optional(FloatingSideSchema),
  floatingAlign: Schema.optional(FloatingAlignSchema),
} as const
