/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const ImageTypeLiteral = Schema.Literal('image')

export const ImageVariantSchema = Schema.Literal(
  'default',
  'avatar',
  'thumbnail',
  'hero'
).annotations({
  title: 'Image Variant',
  description: 'Image presentation variant.',
})

export const imageFields = {
  ...coreFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  variant: Schema.optional(ImageVariantSchema),
} as const
