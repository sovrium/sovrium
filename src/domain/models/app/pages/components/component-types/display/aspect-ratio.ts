/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { responsiveFields } from '../modules/responsive'

export const AspectRatioTypeLiteral = Schema.Literal('aspect-ratio')

export const aspectRatioFields = {
  ...coreFields,
  ...responsiveFields,
  ratio: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Width-to-height ratio (e.g. 16/9 = 1.778, 1 = square)',
      })
    )
  ),
} as const
