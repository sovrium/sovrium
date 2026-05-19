/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'

export const sovriumRuntimeSchema = z
  .enum(['postgres', 'sqlite-aio'])
  .describe('Active database runtime backing this Sovrium process')

export type SovriumRuntime = z.infer<typeof sovriumRuntimeSchema>

export const configVersionResponseSchema = z
  .object({
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+(-.*)?$/)
      .describe(
        'Semantic version string from package.json baked into the binary at build time (e.g. "0.3.0" or "1.0.0-beta.4")'
      ),
    commit: z
      .string()
      .regex(/^([0-9a-f]{7,40}|unknown)$/)
      .describe(
        'Short git commit SHA (7-40 lowercase hex chars) injected at build time via SOVRIUM_COMMIT_SHA, or the literal "unknown" when the env var is unset'
      ),
    runtime: sovriumRuntimeSchema,
    nodeVersion: z
      .string()
      .min(1)
      .describe(
        'Bun runtime version powering this Sovrium process. Field name retained for OpenAPI tooling familiarity (the value is Bun.version, not Node.js)'
      ),
    startedAt: z.iso
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp captured once at process boot; identical across all calls within a single process lifetime'
      ),
  })
  .openapi('ConfigVersionResponse')

export type ConfigVersionResponse = z.infer<typeof configVersionResponseSchema>
