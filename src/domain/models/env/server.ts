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
    Schema.NumberFromString.pipe(
      Schema.int(),
      Schema.greaterThanOrEqualTo(1),
      Schema.lessThanOrEqualTo(65_535),
      Schema.annotations({ description: 'Server port (PORT)', examples: [3000] })
    )
  ),
  baseUrl: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^https?:\/\/.+/),
      Schema.annotations({
        description: 'Base URL of the application (BASE_URL)',
        examples: ['http://localhost:3000'],
      })
    )
  ),
})

export type ServerEnvConfig = Schema.Schema.Type<typeof ServerEnvSchema>

/** @public */
export const parseServerEnvConfig = (): ServerEnvConfig =>
  Schema.decodeUnknownSync(ServerEnvSchema)({
    port: process.env.PORT,
    baseUrl: process.env.BASE_URL,
  })
