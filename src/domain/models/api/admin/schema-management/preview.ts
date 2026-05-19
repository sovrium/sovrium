/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'



export const previewStatusSchema = z.enum(['starting', 'running', 'stopped', 'expired'])

export type PreviewStatus = z.infer<typeof previewStatusSchema>


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

export type StartPreviewResponse = z.infer<typeof startPreviewResponseSchema>


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

export type PreviewStatusResponse = z.infer<typeof previewStatusResponseSchema>


export const stopPreviewResponseSchema = z.object({
  previewId: z.string().min(1).describe('The id of the preview that was stopped'),
  status: z.literal('stopped').describe('Confirms the preview transitioned to "stopped"'),
  stoppedAt: z.iso.datetime().describe('ISO 8601 timestamp when the stop was processed'),
})

export type StopPreviewResponse = z.infer<typeof stopPreviewResponseSchema>
