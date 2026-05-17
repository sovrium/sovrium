/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SkeletonVariantSchema } from '../../form-controls'
import { coreFields } from '../modules/core'

export const SkeletonTypeLiteral = Schema.Literal('skeleton')

export const skeletonFields = {
  ...coreFields,
  skeletonVariant: Schema.optional(SkeletonVariantSchema),
  skeletonWidth: Schema.optional(
    Schema.String.annotations({ description: 'CSS width for skeleton (e.g. "200px", "100%")' })
  ),
  skeletonHeight: Schema.optional(
    Schema.String.annotations({ description: 'CSS height for skeleton (e.g. "20px", "3rem")' })
  ),
  animate: Schema.optional(
    Schema.Boolean.annotations({
      description: 'Enable pulse animation on skeleton (default: true)',
    })
  ),
} as const
