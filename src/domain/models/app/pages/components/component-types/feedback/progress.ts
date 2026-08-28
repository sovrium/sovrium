/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ComponentSizeSchema, ProgressVariantSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const ProgressTypeLiteral = Schema.Literal('progress')

export const progressFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  progressValue: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0)),
      Schema.annotate({ description: 'Current progress value (0 to progressMax)' })
    )
  ),
  progressMax: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isGreaterThan(0)),
      Schema.annotate({ description: 'Maximum progress value (default: 100)' })
    )
  ),
  showLabel: Schema.optional(
    Schema.Boolean.annotate({ description: 'Display progress percentage label' })
  ),
  size: Schema.optional(ComponentSizeSchema),
  progressVariant: Schema.optional(ProgressVariantSchema),
} as const
