/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ResizableDirectionSchema } from '../../form-controls'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const ResizableTypeLiteral = Schema.Literal('resizable')

export const resizableFields = {
  ...coreFields,
  ...visibilityFields,
  resizableDirection: Schema.optional(ResizableDirectionSchema),
  defaultSizes: Schema.optional(
    Schema.Array(Schema.Number).pipe(
      Schema.minItems(2),
      Schema.annotations({
        description: 'Default panel sizes as percentages (must sum to 100)',
      })
    )
  ),
  minSize: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({ description: 'Minimum panel size as percentage' })
    )
  ),
} as const
