/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AutomationCallActionSchema } from './call'
import { AutomationReturnActionSchema } from './return'

/**
 * Automation Action — `call` (invoke a sub-automation) and `return` (hand
 * data back to the calling automation).
 */
export const AutomationActionSchema = Schema.Union(
  AutomationCallActionSchema,
  AutomationReturnActionSchema
)

/** @public */
export type AutomationAction = Schema.Schema.Type<typeof AutomationActionSchema>

export * from './call'
export * from './return'
