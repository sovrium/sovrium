/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { VisibilitySchema } from '../../visibility'

/**
 * Visibility fields for components that support auth-based/role-based/condition-based show/hide.
 */
export const visibilityFields = {
  visibility: Schema.optional(VisibilitySchema),
} as const
