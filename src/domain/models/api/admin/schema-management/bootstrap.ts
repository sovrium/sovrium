/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Bootstrap-claim request/response schemas
 *
 * Wire-format Zod contract for `POST /api/admin/bootstrap/claim`. The
 * route is mounted unconditionally and returns 404 when not in bootstrap
 * mode (see `src/infrastructure/server/route-setup/bootstrap-routes.ts`).
 *
 * Authentication is via `Authorization: Bearer <token>` header — the
 * bearer token is the plaintext printed to stdout at server boot when
 * Sovrium detected no admin credentials and no users exist.
 *
 * Body validation enforces email/password/name presence; password length
 * minimum (8 chars) is enforced server-side both here and in the
 * Better Auth `createUser` call.
 *
 * The token never appears in the request body — it is read from the
 * Authorization header.
 */

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------

export const bootstrapClaimRequestSchema = z.object({
  email: z.email().describe('Email address for the first admin user'),
  password: z
    .string()
    .min(8)
    .max(128)
    .describe('Initial password for the first admin user. Min 8, max 128 chars.'),
  name: z.string().min(1).max(100).describe('Display name for the first admin user'),
})

/** @public */
export type BootstrapClaimRequest = z.infer<typeof bootstrapClaimRequestSchema>

// ---------------------------------------------------------------------------
// Success response
// ---------------------------------------------------------------------------

export const bootstrapClaimResponseSchema = z.object({
  success: z.literal(true),
  userId: z.string().min(1).describe('Better Auth user id of the newly-created admin'),
  email: z.email().describe('Email of the newly-created admin (echo of request body)'),
})

/** @public */
export type BootstrapClaimResponse = z.infer<typeof bootstrapClaimResponseSchema>
