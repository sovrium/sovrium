/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Preview API request/response schemas
 *
 * Wire-format Zod contracts for `/api/admin/schema/draft/preview/*`.
 *
 * A preview is an out-of-band Bun server spawned on a separate port from
 * the live server, running a candidate draft snapshot in isolation. The
 * admin clicks through the preview URL to probe the new schema before
 * publishing.
 *
 * Lifecycle states (see `system.sovrium_preview_sessions.status`):
 *   starting → running → stopped
 *           ↘──────────→ expired (TTL-driven)
 *
 * TTL: 30 minutes from start (configurable via `PREVIEW_TTL_MINUTES` env;
 * not part of this contract — the server enforces it).
 */

// ---------------------------------------------------------------------------
// Status enum (mirror of PreviewSessionStatusSchema in domain/models/system)
// ---------------------------------------------------------------------------

export const previewStatusSchema = z.enum(['starting', 'running', 'stopped', 'expired'])

/** @public */
export type PreviewStatus = z.infer<typeof previewStatusSchema>

// ---------------------------------------------------------------------------
// Start preview — POST /draft/preview/start
// ---------------------------------------------------------------------------

export const startPreviewRequestSchema = z.object({
  ttlMinutes: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .optional()
    .describe(
      'Preview lifetime in minutes. Defaults to 30. Capped at 1440 (24h) to keep ephemeral semantics.'
    ),
})

/** @public */
export type StartPreviewRequest = z.infer<typeof startPreviewRequestSchema>

export const startPreviewResponseSchema = z.object({
  previewId: z
    .string()
    .min(1)
    .describe('Unique preview-session id, used for subsequent /status and /stop calls'),
  previewUrl: z.url().describe('Full URL of the preview server (includes the alternate port)'),
  port: z.number().int().min(1024).max(65_535).describe('Local port the preview server listens on'),
  expiresAt: z.iso.datetime().describe('ISO 8601 timestamp at which the preview will expire'),
  status: previewStatusSchema.describe(
    'Initial status. Typically "starting" — clients should poll /status until it becomes "running".'
  ),
})

/** @public */
export type StartPreviewResponse = z.infer<typeof startPreviewResponseSchema>

// ---------------------------------------------------------------------------
// Status — GET /draft/preview
// ---------------------------------------------------------------------------

export const previewStatusResponseSchema = z.object({
  active: z.boolean().describe('True when a non-expired/non-stopped preview is in flight'),
  preview: z
    .object({
      previewId: z.string().min(1),
      previewUrl: z.url(),
      port: z.number().int().min(1024).max(65_535),
      status: previewStatusSchema,
      expiresAt: z.iso.datetime(),
      createdAt: z.iso.datetime(),
      createdByUserId: z.string().min(1),
    })
    .optional()
    .describe('Active preview descriptor, omitted when active=false'),
})

/** @public */
export type PreviewStatusResponse = z.infer<typeof previewStatusResponseSchema>

// ---------------------------------------------------------------------------
// Stop preview — POST /draft/preview/stop
// ---------------------------------------------------------------------------

export const stopPreviewResponseSchema = z.object({
  previewId: z.string().min(1).describe('The id of the preview that was stopped'),
  status: z.literal('stopped').describe('Confirms the preview transitioned to "stopped"'),
  stoppedAt: z.iso.datetime().describe('ISO 8601 timestamp when the stop was processed'),
})

/** @public */
export type StopPreviewResponse = z.infer<typeof stopPreviewResponseSchema>
