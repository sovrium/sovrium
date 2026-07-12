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

export const SplitPaneTypeLiteral = Schema.Literal('split-pane')

export const SplitPaneOrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Split-pane Orientation',
  description:
    'Split direction: horizontal (side-by-side) or vertical (stacked). Default: horizontal.',
})

export const splitPaneFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  orientation: Schema.optional(SplitPaneOrientationSchema),
  defaultRatio: Schema.optional(
    Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThan(1)).annotations({
      description: 'Initial fraction of the container the first pane occupies (0–1). Default: 0.5.',
    })
  ),
  minSize: Schema.optional(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)).annotations({
      description: 'Minimum size (px) of the first pane while resizing.',
    })
  ),
  maxSize: Schema.optional(
    Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)).annotations({
      description: 'Maximum size (px) of the first pane while resizing.',
    })
  ),
} as const
