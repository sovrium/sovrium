/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'


export const CONNECTION_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000


export const connectionStatusSchema = z
  .enum(['active', 'expiring-soon', 'expired'])
  .describe(
    'Derived connection health. `active` = tokens all in the future OR no tokens (apiKey/no-expiry case); `expiring-soon` = soonest token expiry within 7 days; `expired` = soonest token expiry in the past.'
  )

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>


export const connectionRowActionSchema = z
  .enum(['connect', 'reconnect', 'disconnect', 'none'])
  .describe(
    'Derived per-row connect affordance: `connect` (oauth2, no tokens) / `reconnect` (oauth2, expiring/expired tokens) / `disconnect` (oauth2, healthy tokens) / `none` (non-oauth2). Server-computed display hint for config-driven action gating.'
  )

export type ConnectionRowAction = z.infer<typeof connectionRowActionSchema>


export const connectionListItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Unique connection id (`system.connections.id`, a uuid). The path segment the connection-detail endpoint resolves by.'
      ),
    name: z
      .string()
      .min(1)
      .describe('Connection name (`system.connections.name`), the app-config-declared identifier.'),
    provider: z
      .string()
      .min(1)
      .describe(
        'Connection provider (`system.connections.provider`), e.g. `google`, `slack`, `stripe`. Drives the dashboard icon hint.'
      ),
    type: z
      .string()
      .min(1)
      .describe(
        'Connection auth type (`system.connections.type`): `oauth2` | `apiKey` | `basic` | `bearer`. Only `oauth2` (user-scope) generates per-user token rows.'
      ),
    tokenCount: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Number of per-user token rows for this connection (`COUNT(connection_tokens.id)`). `0` for apiKey/basic/bearer connections (which never generate tokens) and for oauth2 connections nobody has authorized yet.'
      ),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp of the SOONEST token expiry across this connection (`MIN(connection_tokens.expires_at)`). `null` when there are no token rows OR no token recorded an expiry (long-lived tokens).'
      ),
    status: connectionStatusSchema,
    rowAction: connectionRowActionSchema,
    createdAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp the connection row was created (`system.connections.created_at`).'
      ),
  })
  .strict()
  .openapi('ConnectionListItem')

export const connectionsListResponseSchema = z
  .object({
    connections: z
      .array(connectionListItemSchema)
      .describe('Every connection configured for the app, with its token/expiry summary.'),
  })
  .strict()
  .openapi('ConnectionsListResponse')


export const connectionUserTokenSchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .describe(
        'Subject identifier of the user who holds this token row (`connection_tokens.user_id`). Matches `auth.users.id`.'
      ),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp this user’s token expires (`connection_tokens.expires_at`). `null` when no expiry was recorded (long-lived token).'
      ),
    status: connectionStatusSchema.describe(
      'Derived per-user token health: `expired` if this row’s `expiresAt` is in the past, `expiring-soon` if within 7 days, `active` otherwise (including no recorded expiry).'
    ),
  })
  .strict()
  .openapi('ConnectionUserToken')

export const connectionDetailResponseSchema = z
  .object({
    connection: connectionListItemSchema.describe(
      'The connection header — the same secret-free fields as the list item.'
    ),
    tokens: z
      .array(connectionUserTokenSchema)
      .describe(
        'Per-user token rows (secret-free: `userId` + `expiresAt` + per-user `status`). Empty for apiKey/basic/bearer connections and for oauth2 connections nobody has authorized.'
      ),
  })
  .strict()
  .openapi('ConnectionDetailResponse')


export type ConnectionListItem = z.infer<typeof connectionListItemSchema>
export type ConnectionsListResponse = z.infer<typeof connectionsListResponseSchema>
export type ConnectionUserToken = z.infer<typeof connectionUserTokenSchema>
export type ConnectionDetailResponse = z.infer<typeof connectionDetailResponseSchema>
