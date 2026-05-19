/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ScrollOrientationSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const ScrollAreaTypeLiteral = Schema.Literal('scroll-area')

export const scrollAreaFields = {
  ...coreFields,
  ...visibilityFields,
  scrollAreaHeight: Schema.optional(
    Schema.String.annotations({
      description: 'CSS max-height for the scroll area (e.g. "400px")',
    })
  ),
  scrollOrientation: Schema.optional(ScrollOrientationSchema),
} as const
