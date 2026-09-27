/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ConnectionCallActionSchema } from './call'

/**
 * Connection Action Union — operations of the `connection` action family.
 * One operator today: `call`.
 */
export const ConnectionActionSchema = Schema.Union([ConnectionCallActionSchema])

/** @public */
export type ConnectionAction = Schema.Schema.Type<typeof ConnectionActionSchema>
