/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The caller a table's definition and view routes answer, resolved exactly as
 * its records route resolves it: the role and groups the table middleware put
 * on the request, the `user_access` roles the records route adds on a table
 * with row-level rules, and whether the request carries no session at all.
 */

import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { resolveAccessRolesFor } from './row-level-guard'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { TableCaller } from '@/application/use-cases/tables/table-operations'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export const resolveTableReadCaller = async (
  c: Context,
  app: App,
  context: Readonly<{
    session: Pick<UserSession, 'userId'> | undefined
    tableName: string
    userRole: string
    userGroups: readonly string[]
  }>
): Promise<TableCaller> => {
  const table = app.tables?.find((t) => t.name === context.tableName)
  const accessRoles = await resolveAccessRolesFor(c, context.session, table ? [table] : [])
  return {
    role: context.userRole,
    groups: context.userGroups,
    accessRoles,
    anonymous: isGuestSession(context.session?.userId),
  }
}
