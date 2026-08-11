/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ResponsiveSchema } from '../../responsive'

/**
 * Responsive fields for components that adapt to breakpoints.
 * Layout containers and components that change shape/content across screen sizes.
 */
export const responsiveFields = {
  responsive: Schema.optional(ResponsiveSchema),
} as const
