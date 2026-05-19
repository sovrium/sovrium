/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'



export const bootstrapClaimRequestSchema = z.object({
  email: z.email().describe('Email address for the first admin user'),
  password: z
    .string()
    .min(8)
    .max(128)
    .describe('Initial password for the first admin user. Min 8, max 128 chars.'),
  name: z.string().min(1).max(100).describe('Display name for the first admin user'),
})

export type BootstrapClaimRequest = z.infer<typeof bootstrapClaimRequestSchema>


export const bootstrapClaimResponseSchema = z.object({
  success: z.literal(true),
  userId: z.string().min(1).describe('Better Auth user id of the newly-created admin'),
  email: z.email().describe('Email of the newly-created admin (echo of request body)'),
})

export type BootstrapClaimResponse = z.infer<typeof bootstrapClaimResponseSchema>
