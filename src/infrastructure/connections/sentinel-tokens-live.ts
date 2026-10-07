/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { SentinelTokens } from '@/application/ports/services/sentinel-tokens'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'

/**
 * The seeder-placeholder detector, answered by the module that defines the
 * placeholder. Stateless: no lifetime, so `Layer.succeed`.
 */
export const SentinelTokensLive = Layer.succeed(SentinelTokens, { isSentinelAccessToken })
