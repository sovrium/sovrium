/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Bearer Token Plugin Configuration
 *
 * Enables bearer token authentication for API requests.
 * Useful for stateless API authentication.
 *
 * When enabled, users can authenticate API requests using:
 * Authorization: Bearer <token>
 *
 * @example
 * ```typescript
 * // Enable bearer token auth
 * { plugins: { bearer: true } }
 * ```
 */
export const BearerConfigSchema = Schema.Boolean.pipe(
  Schema.annotations({
    title: 'Bearer Token Plugin',
    description: 'Enable bearer token authentication for API requests',
  })
)

export type BearerConfig = Schema.Schema.Type<typeof BearerConfigSchema>
