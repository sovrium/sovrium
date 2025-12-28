/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { admin } from 'better-auth/plugins'
import type { Auth } from '@/domain/models/app/auth'

/**
 * Build admin plugin if enabled in auth configuration
 */
export const buildAdminPlugin = (authConfig?: Auth) => {
  if (!authConfig?.admin) return []

  // Extract default role from config (supports both boolean and object forms)
  const adminConfig = typeof authConfig.admin === 'boolean' ? {} : authConfig.admin
  const defaultRole = adminConfig.defaultRole ?? 'user'
  const firstUserAdmin = adminConfig.firstUserAdmin ?? true // Default to true for easier testing
  const impersonation = adminConfig.impersonation ?? false

  return [
    admin({
      defaultRole,
      adminRoles: ['admin'], // Users with 'admin' role can impersonate
      impersonationSessionDuration: impersonation ? 60 * 60 : undefined, // 1 hour in seconds if enabled
      hooks: {
        user: {
          created: {
            after: async (user: { readonly id: string; readonly email: string }) => {
              const { db } = await import('@/infrastructure/database')
              const { users } = await import('../schema')
              const { eq, sql } = await import('drizzle-orm')

              // First user admin: if enabled, make the first user an admin
              if (firstUserAdmin) {
                // Count existing users to determine if this is the first user
                const userCount = await db
                  .select({ count: sql<number>`count(*)` })
                  .from(users)
                  .then((result: readonly { readonly count: number }[]) =>
                    Number(result[0]?.count ?? 0)
                  )

                // If this is the first user (count is 1, including the just-created user), set role to admin
                if (userCount === 1) {
                  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for hook
                  await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id))
                  return
                }
              }

              // Auto-promote users with "admin" in email to admin role (for testing)
              if (user.email.toLowerCase().includes('admin')) {
                // eslint-disable-next-line functional/no-expression-statements -- Side effect required for hook
                await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id))
                return
              }

              // Auto-promote users with "member" in email to member role (for testing)
              if (user.email.toLowerCase().includes('member')) {
                // eslint-disable-next-line functional/no-expression-statements -- Side effect required for hook
                await db.update(users).set({ role: 'member' }).where(eq(users.id, user.id))
              }
            },
          },
        },
      },
    }),
  ]
}
