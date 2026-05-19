/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'


export const connectionUserStatusSchema = z
  .enum(['connected', 'disconnected', 'expired'])
  .describe(
    'Per-user connection status. `connected` = active token; `expired` = token past its expiry; `disconnected` = no token or explicitly cleared.'
  )

export type ConnectionUserStatus = z.infer<typeof connectionUserStatusSchema>


export const connectionUserEntrySchema = z
  .object({
    userId: z
      .string()
      .describe(
        'Subject identifier of the user who authorized this connection. Matches `auth.users.id`.'
      ),
    status: connectionUserStatusSchema,
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 timestamp when the access token expires. `null` when no expiry was recorded by the provider (long-lived tokens).'
      ),
  })
  .strict()

export type ConnectionUserEntry = z.infer<typeof connectionUserEntrySchema>


export const connectionUsersResponseSchema = z
  .object({
    users: z
      .array(connectionUserEntrySchema)
      .describe(
        'Members who have completed OAuth authorization for this connection. Admin users are excluded — their token rows are auth-only artifacts (see `dropAdminUsers` in users-handler).'
      ),
  })
  .strict()

export type ConnectionUsersResponse = z.infer<typeof connectionUsersResponseSchema>
