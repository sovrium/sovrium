/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Admin storage status response schema
 *
 * Returns the active storage configuration parsed from environment variables.
 * Used by administrators to verify which storage provider is configured and
 * which optional values (e.g. region) were applied via defaults.
 *
 * Provider-specific fields:
 * - `s3`: region, bucket, endpoint, forcePathStyle
 * - `local`: directory
 * - `bytea`: (no extra fields)
 * - `disabled`: returned when no storage provider is configured
 */
export const storageStatusResponseSchema = z.object({
  provider: z
    .enum(['s3', 'local', 'bytea', 'disabled'])
    .describe('Active storage provider, or "disabled" if none is configured'),
  region: z.string().optional().describe('AWS region (S3 only; defaults to us-east-1)'),
  bucket: z.string().optional().describe('S3 bucket name (S3 only)'),
  endpoint: z.string().optional().describe('S3-compatible endpoint URL (S3 only)'),
  forcePathStyle: z.boolean().optional().describe('Whether path-style URLs are enabled (S3 only)'),
  directory: z.string().optional().describe('Local filesystem storage directory (local only)'),
})

/**
 * TypeScript type inferred from Zod schema.
 */
export type StorageStatusResponse = z.infer<typeof storageStatusResponseSchema>
