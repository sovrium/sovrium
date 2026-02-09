/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Health check response schema
 *
 * Defines the shape of the health check API response.
 * This schema is shared between:
 * - Regular Hono routes (for runtime validation and RPC typing)
 * - OpenAPI schema generation (for API documentation)
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok').describe('Server health status indicator'),
  timestamp: z.iso
    .datetime({
      offset: true,
      precision: 3,
    })
    .describe('ISO 8601 timestamp of the health check'),
  app: z
    .object({
      name: z.string().describe('Application name from configuration'),
    })
    .describe('Application metadata'),
})

/**
 * TypeScript type inferred from Zod schema
 *
 * Use this type for type-safe health check responses in application code.
 */
export type HealthResponse = z.infer<typeof healthResponseSchema>
