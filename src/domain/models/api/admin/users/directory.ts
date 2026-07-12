/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'


export const adminDirectoryUserSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Subject identifier of the account (`auth.user.id`). The id the row actions (set-role / ban-user / unban-user) target.'
      ),
    email: z
      .string()
      .min(1)
      .describe(
        'Account e-mail address (`auth.user.email`). The directory’s primary column and the client-side search key.'
      ),
    role: z
      .string()
      .min(1)
      .describe(
        'Account role (`auth.user.role`). The column is nullable in storage; the handler coalesces a null/empty role to the app default role, so this is always a non-empty string. The vocabulary is the APP’s configured roles, not the operator tier.'
      ),
    banned: z
      .boolean()
      .describe(
        'Whether the account is banned (`auth.user.banned`). Drives the Statut pill: `false` → actif, `true` → banni.'
      ),
  })
  .strict()
  .openapi('AdminDirectoryUser')


export const adminUsersDirectoryResponseSchema = z
  .object({
    users: z
      .array(adminDirectoryUserSchema)
      .describe(
        'Every account in the auth `user` table — operators and app users alike — as secret-free directory rows.'
      ),
  })
  .strict()
  .openapi('AdminUsersDirectoryResponse')


export type AdminDirectoryUser = z.infer<typeof adminDirectoryUserSchema>
export type AdminUsersDirectoryResponse = z.infer<typeof adminUsersDirectoryResponseSchema>
