/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import type { ContextWithSession } from './auth'
import type { Session } from '@/application/ports/models/user-session'
import type { App } from '@/domain/models/app'
import type { Context, Next } from 'hono'


export type ContextWithValidatedTable = ContextWithSession & {
  readonly var: {
    readonly tableName: string
    readonly tableId: string
  }
}

export type ContextWithUserRole = ContextWithSession & {
  readonly var: {
    readonly userRole: string
    readonly userGroups: readonly string[]
  }
}

export type ContextWithTableAndRole = Context & {
  readonly var: {
    readonly session: Session
    readonly tableName: string
    readonly tableId: string
    readonly userRole: string
    readonly userGroups: readonly string[]
  }
}


export function validateTable(app: App) {
  return async (c: Context, next: Next) => {
    const tableId = c.req.param('tableId')

    if (!tableId) {
      return c.json(
        { success: false, message: 'Table ID parameter required', code: 'VALIDATION_ERROR' },
        400
      )
    }

    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
    }

    c.set('tableName', table.name)
    c.set('tableId', tableId)

    await next()
  }
}

export function enrichUserRole(
  getUserRoleFn?: (userId: string) => Promise<string>,
  getUserGroupsFn?: (userId: string) => Promise<readonly string[]>
) {
  const resolveRole = getUserRoleFn ?? getUserRole
  const resolveGroups = getUserGroupsFn ?? getUserGroups

  return async (c: Context, next: Next) => {
    const { session } = (c as ContextWithSession).var

    if (!session) {
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }

    const [userRole, userGroups] = await Promise.all([
      resolveRole(session.userId),
      resolveGroups(session.userId),
    ])

    c.set('userRole', userRole)
    c.set('userGroups', userGroups)

    await next()
  }
}
