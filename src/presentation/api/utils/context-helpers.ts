/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Session } from '@/application/ports/models/user-session'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { ContextWithTableAndRole } from '@/presentation/api/middleware/table'
import type { Context } from 'hono'

export function getSessionContext(c: Context): Session | undefined {
  return (c as ContextWithSession).var.session
}

export function getTableContext(c: Context): {
  readonly session: Session
  readonly tableName: string
  readonly tableId: string
  readonly userRole: string
  readonly userGroups: readonly string[]
} {
  const { var: ctx } = c as ContextWithTableAndRole
  return {
    session: ctx.session,
    tableName: ctx.tableName,
    tableId: ctx.tableId,
    userRole: ctx.userRole,
    userGroups: ctx.userGroups ?? [],
  }
}
