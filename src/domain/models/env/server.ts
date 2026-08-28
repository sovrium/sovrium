/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Server environment configuration.
 *
 * Env vars: PORT, BASE_URL
 */
export const ServerEnvSchema = Schema.Struct({
  port: Schema.optional(
    Schema.FiniteFromString.pipe(
      Schema.check(
        Schema.isInt(),
        Schema.isGreaterThanOrEqualTo(1),
        Schema.isLessThanOrEqualTo(65_535)
      ),
      Schema.annotate({ description: 'Server port (PORT)', examples: [3000] })
    )
  ),
  baseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isPattern(/^https?:\/\/.+/)),
      Schema.annotate({
        description: 'Base URL of the application (BASE_URL)',
        examples: ['http://localhost:3000'],
      })
    )
  ),
})
