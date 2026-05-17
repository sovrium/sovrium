/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from '../../action'

/**
 * Action field for components that trigger user actions (onClick/onSubmit).
 * Only for buttons, links, forms, menu items — NOT for layout or display components.
 */
export const actionFields = {
  action: Schema.optional(ActionSchema),
} as const
