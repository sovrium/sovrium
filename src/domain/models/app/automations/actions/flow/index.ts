/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { FlowStopActionSchema } from './stop'
import type { Schema } from 'effect'

/**
 * Flow Action — currently only the 'stop' operator
 */
export const FlowActionSchema = FlowStopActionSchema

/** @public */
export type FlowAction = Schema.Schema.Type<typeof FlowActionSchema>

export * from './stop'
