/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { InteractionsSchema } from '../../interactions/interactions'

/**
 * Interaction fields for components that support hover, entrance, and scroll animations.
 * NOT for structural/feedback/form-control components.
 */
export const interactionFields = {
  interactions: Schema.optional(InteractionsSchema),
} as const
