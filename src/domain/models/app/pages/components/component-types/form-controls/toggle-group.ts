/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterPublisherSchema } from '../../data-source-publishers'
import { OptionsSchema, OrientationSchema, ToggleTypeSchema } from '../../form-controls'
import { ComponentSizeSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'
import { ToggleVariantSchema } from './toggle'

export const ToggleGroupTypeLiteral = Schema.Literal('toggle-group')

export const toggleGroupFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  options: Schema.optional(OptionsSchema),
  orientation: Schema.optional(OrientationSchema),
  toggleType: Schema.optional(ToggleTypeSchema),
  size: Schema.optional(ComponentSizeSchema),
  /** The look of every item; borderless when omitted. */
  toggleVariant: Schema.optional(ToggleVariantSchema),
  /** The gap between items, in spacing steps; 2 when omitted, 0 joins them. */
  spacing: Schema.optional(
    Schema.Finite.annotate({
      description:
        "The gap between the items, in spacing steps of 0.25rem: 2, the default, stands them apart, and 0 joins them into one control. shadcn/ui's ToggleGroup spacing.",
      examples: [0, 1, 2],
    }).pipe(Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 8 })))
  ),
  /**
   * Narrow the data components on a channel from the pressed item.
   *
   * The published value is the pressed item's `value`; under
   * `toggleType: multiple` it is the pressed values joined by commas, which the
   * `in` operator of the condition form reads as "any of". Nothing pressed
   * withdraws the contribution.
   */
  publishes: Schema.optional(SharedFilterPublisherSchema),
} as const
